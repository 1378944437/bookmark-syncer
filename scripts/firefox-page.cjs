// web-ext 9.2 RDP connection; Firefox extension tabs are not exposed by this Playwright runtime.
const assert = require('node:assert/strict');
module.exports = async function openExtensionPage(remote, url) {
  const client = remote.client, handleMessage = client._handleMessage.bind(client);
  client._handleMessage = packet => packet.type === 'evaluationResult'
    ? client.emit('marksync-evaluation', packet) : handleMessage(packet);
  async function evaluate(actor, text) {
    let remove;
    const result = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { remove(); reject(new Error('Firefox evaluation timeout')); }, 15000);
      const listener = packet => {
        if (packet.from !== actor) return;
        clearTimeout(timeout); remove();
        if (packet.hasException) reject(new Error(packet.exceptionMessage || 'Firefox evaluation failed'));
        else resolve(packet.result);
      };
      remove = () => client.removeListener('marksync-evaluation', listener);
      client.on('marksync-evaluation', listener);
    });
    // Register the result listener before dispatch. Evaluations on this connection are sequential.
    const dispatched = client.request({ to: actor, type: 'evaluateJSAsync', text });
    const [, value] = await Promise.all([dispatched, result]);
    return value;
  }
  const parent = await client.request({ to: 'root', type: 'getProcess', id: 0 });
  const target = await client.request({ to: parent.processDescriptor.actor, type: 'getTarget' });
  await evaluate(target.process.consoleActor,
    `Services.wm.getMostRecentWindow('navigator:browser').gBrowser.addTab(${JSON.stringify(url)}, {triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()})`);
  let tab;
  for (let attempt = 0; attempt < 50 && !tab; attempt++) {
    tab = (await client.request('listTabs')).tabs.find(tab => tab.url === url);
    if (!tab) await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(tab, 'Firefox extension tab not found');
  const frame = await client.request({ to: tab.actor, type: 'getTarget' });
  const actor = frame.frame.consoleActor;
  return { async evaluate(fn, argument) {
    await evaluate(actor, `globalThis.__marksyncTestResult = {done:false};
      (async () => { try { const value = await ((chrome) => (${fn.toString()})(${JSON.stringify(argument) ?? 'undefined'}))(browser);
        globalThis.__marksyncTestResult = {done:true, value:JSON.stringify(value)};
      } catch (error) { globalThis.__marksyncTestResult = {done:true, error:String(error)}; } })()`);
    const started = Date.now();
    while (Date.now() - started < 30000) {
      let value = await evaluate(actor, 'JSON.stringify(globalThis.__marksyncTestResult)');
      if (value?.type === 'longString') value = (await client.request({ to: value.actor, type: 'substring', start: 0, end: value.length })).substring;
      const result = JSON.parse(value);
      if (result.done) {
        await evaluate(actor, 'delete globalThis.__marksyncTestResult');
        if (result.error) throw new Error(result.error);
        return result.value === undefined ? undefined : JSON.parse(result.value);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Firefox async operation timed out');
  } };
};
