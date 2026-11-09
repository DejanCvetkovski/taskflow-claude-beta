const { chromium } = require('playwright');
const OUT = process.env.OUT || 'docs/qa/';
const results = []; let fails = 0;
function check(name, ok, extra='') { results.push(`${ok?'PASS':'FAIL'} ${name}${extra?' — '+extra:''}`); if(!ok) fails++; }
async function noEdit(page, w, label) {
  const editBtns = await page.getByRole('button', { name: /edit|rename|save/i }).count();
  const ce = await page.locator('[contenteditable]:not([contenteditable="false"])').count();
  const textInputs = await page.locator('input[type="text"], input:not([type]), textarea').count();
  const editText = await page.getByText(/^\s*(edit|save|cancel)\s*$/i).count();
  check(`${w}px ${label}: no edit control (edit/save buttons=${editBtns}, contenteditable=${ce}, text inputs=${textInputs}, edit text=${editText})`, editBtns===0 && ce===0 && textInputs===1 && editText===0);
}
(async () => {
  const browser = await chromium.launch();
  for (const w of [375, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    const patches = [];
    page.on('request', r => { if (r.method()==='PATCH') patches.push(r.postData()); });
    const errors = []; page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    // clean slate
    const list = await (await ctx.request.get('http://localhost:8000/api/todos')).json();
    for (const t of list) await ctx.request.delete(`http://localhost:8000/api/todos/${t.id}`);
    await page.goto('http://localhost:5173/');
    await page.getByText(/no tasks|nothing/i).first().waitFor({ timeout: 5000 }).catch(()=>{});
    await noEdit(page, w, 'empty');
    const input = page.locator('#new-todo');
    for (const t of ['Buy milk', 'Write report', 'Call Ana']) { await input.fill(t); await input.press('Enter'); await page.getByText(t, { exact: true }).waitFor(); }
    check(`${w}px create: 3 items shown`, await page.locator('li.todo').count() === 3);
    await noEdit(page, w, 'with items');
    // double-click and Enter/F2 on title should not open editor
    await page.getByText('Buy milk', { exact: true }).dblclick();
    await page.getByText('Buy milk', { exact: true }).click(); await page.keyboard.press('F2'); await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await noEdit(page, w, 'after dblclick/F2/Enter on title');
    await page.screenshot({ path: `${OUT}remove-edit-${w}-list.png`, fullPage: true });
    // toggle
    await page.getByLabel('Mark “Write report” as completed').click();
    await page.getByLabel('Mark “Write report” as active').waitFor();
    check(`${w}px toggle: Write report completed`, await page.locator('li.todo-done').count() === 1);
    // filters
    const fb = page.getByRole('group', { name: 'Filter tasks' });
    await fb.getByRole('button', { name: /^Active/ }).click();
    check(`${w}px filter Active shows 2`, await page.locator('li.todo').count() === 2);
    await fb.getByRole('button', { name: /^Completed/ }).click();
    check(`${w}px filter Completed shows 1`, await page.locator('li.todo').count() === 1 && await page.getByText('Write report', {exact:true}).count()===1);
    await fb.getByRole('button', { name: /^All/ }).click();
    check(`${w}px filter All shows 3`, await page.locator('li.todo').count() === 3);
    const countText = await page.locator('.filter-bar').innerText();
    check(`${w}px active count shows 2`, /2\s+(items?|tasks?)?\s*left|2 active|\b2\b/i.test(countText), JSON.stringify(countText.split('\n')[0]));
    // delete with confirm, keyboard
    await page.getByRole('button', { name: 'Delete “Call Ana”' }).focus();
    await page.keyboard.press('Enter');
    const noFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    check(`${w}px delete confirm: focus moves to No`, noFocused === 'No, keep “Call Ana”', noFocused);
    await page.screenshot({ path: `${OUT}remove-edit-${w}-delete-confirm.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    let fl = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (fl !== 'Delete “Call Ana”') { await page.getByRole('button', { name: 'No, keep “Call Ana”' }).click(); fl = await page.evaluate(() => document.activeElement?.getAttribute('aria-label')); }
    check(`${w}px cancel delete returns focus to Delete`, fl === 'Delete “Call Ana”', fl);
    await page.keyboard.press('Enter'); // reopen confirm
    await page.keyboard.press('Shift+Tab'); // to Yes
    const yes = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    await page.keyboard.press('Enter');
    await page.getByText('Call Ana', { exact: true }).waitFor({ state: 'detached' });
    check(`${w}px keyboard delete via Yes`, yes === 'Yes, delete “Call Ana”' && await page.locator('li.todo').count() === 2, yes);
    // keyboard tab order and visible focus
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const order = [];
    for (let i=0;i<15;i++) { await page.keyboard.press('Tab'); const atBody = await page.evaluate(() => document.activeElement===document.body); if (atBody) break; order.push(await page.evaluate(() => { const e=document.activeElement; const cs=getComputedStyle(e); return (e.getAttribute('aria-label')||e.textContent||e.id||e.tagName).trim().slice(0,40) + ((cs.outlineStyle!=='none'&&cs.outlineWidth!=='0px')||cs.boxShadow!=='none' ? '' : ' [NO VISIBLE FOCUS]'); })); }
    check(`${w}px keyboard tab order has no edit stop and all stops show focus`, !order.some(o => /edit|NO VISIBLE/i.test(o)), order.join(' | '));
    // keyboard toggle via Space
    await page.getByLabel('Mark “Buy milk” as completed').focus(); await page.keyboard.press('Space');
    await page.getByLabel('Mark “Buy milk” as active').waitFor();
    check(`${w}px keyboard toggle via Space`, true);
    await page.getByLabel('Mark “Buy milk” as active').focus();
    await page.screenshot({ path: `${OUT}remove-edit-${w}-keyboard-focus.png`, fullPage: true });
    // reload persistence
    await page.reload(); await page.getByText('Buy milk', { exact: true }).waitFor();
    const titles = await page.locator('.todo-title').allInnerTexts();
    const done = await page.locator('li.todo-done .todo-title').allInnerTexts();
    check(`${w}px reload: 2 items, both completed persisted`, titles.length===2 && done.length===2, JSON.stringify({titles, done}));
    await noEdit(page, w, 'after reload');
    await page.getByLabel('Mark “Write report” as active').click(); await page.getByLabel('Mark “Write report” as completed').waitFor();
    await page.reload(); await page.getByText('Write report', { exact: true }).waitFor();
    check(`${w}px reload after untoggle persists`, (await page.locator('li.todo-done').count()) === 1);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`${w}px no horizontal overflow`, sw <= w, `scrollWidth=${sw}`);
    check(`${w}px every PATCH body is completed-only`, patches.length>0 && patches.every(p => { const o=JSON.parse(p); return Object.keys(o).join()==='completed'; }), JSON.stringify(patches));
    check(`${w}px no console errors`, errors.length===0, errors.join('; '));
    await ctx.close();
  }
  await browser.close();
  console.log(results.join('\n')); console.log(`\n${fails} failure(s)`);
})();
