const fs = require('fs');
let html = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\bulk-admin.html', 'utf8');

const replacement = <select id="templateMode">
          <option value="random">عشوائي لكل مقال (ذكي)</option>
          <option value="1">قالب 1</option><option value="2">قالب 2</option>
          <option value="3">قالب 3 (موسع)</option><option value="4">قالب 4</option>
          <option value="5">قالب 5</option><option value="6">قالب 6</option>
          <option value="7">قالب 7</option><option value="8">قالب 8</option>
          <option value="9">قالب 9</option><option value="10">قالب 10</option>
          <option value="11">قالب 11</option><option value="12">قالب 12</option>
          <option value="13">قالب 13</option><option value="14">قالب 14</option>
          <option value="15">قالب 15</option><option value="16">قالب 16 (تقنية)</option>
          <option value="17">قالب 17 (فضاء)</option><option value="18">قالب 18 (تاريخ)</option>
          <option value="19">قالب 19 (طب)</option><option value="20">قالب 20 (طهي)</option>
          <option value="21">قالب 21 (عمارة)</option><option value="22">قالب 22 (فلسفة)</option>
          <option value="23">قالب 23 (ألعاب)</option><option value="24">قالب 24 (محركات)</option>
          <option value="25">قالب 25 (قانون)</option><option value="26">قالب 26 (أحياء)</option>
          <option value="27">قالب 27 (استثمار)</option><option value="28">قالب 28 (موضة)</option>
          <option value="29">قالب 29 (أساطير)</option><option value="30">قالب 30 (طفولة)</option>
        </select>;

html = html.replace(/<select id="templateMode">[\s\S]*?<\/select>/, replacement);

fs.writeFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\bulk-admin.html', html, 'utf8');
console.log('Dropdown updated.');
