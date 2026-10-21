import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Package using Windows x64 Node.js.');
if (process.version !== 'v24.15.0') throw new Error('Update the bundled Node license to match the runtime version before packaging.');
const output = path.join(root, 'release', `约会保卫战-Windows试玩版-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await fs.mkdir(path.join(output, 'runtime'), { recursive: true });
await fs.cp(path.join(root, 'dist'), path.join(output, 'game'), { recursive: true });
await fs.copyFile(process.execPath, path.join(output, 'runtime', 'node.exe'));
await fs.copyFile(path.join(root, 'scripts', 'portable-server.cjs'), path.join(output, 'server.cjs'));
await fs.copyFile(path.join(root, 'scripts', 'NODE-LICENSE.txt'), path.join(output, 'runtime', 'NODE-LICENSE.txt'));
await fs.writeFile(path.join(output, '启动试玩.cmd'), '@echo off\r\ncd /d "%~dp0"\r\n"runtime\\node.exe" "server.cjs"\r\nif errorlevel 1 pause\r\n');
await fs.writeFile(path.join(output, '试玩说明.txt'), `约会保卫战 · Windows 免安装试玩版

适用：Windows 10/11 64 位电脑，已安装 Edge 或 Chrome 等现代浏览器。
1. 先把整个 ZIP 解压到一个文件夹，不要直接在压缩包里运行。
2. 双击“启动试玩.cmd”，浏览器会自动打开游戏。
3. 游戏期间保留启动窗口；结束试玩后关闭窗口即可。
4. 浏览器没有自动打开时，复制启动窗口中的网址到浏览器。

不需要安装 Node.js 或下载依赖。游戏资源已随包附带，可离线试玩。
请保留所有文件和子文件夹；不要直接双击 game/index.html。

玩法：点击街边物品或墙上藤蔓，再点击部署格，点击开始本波。
支持暂停、倍速、重开和完整五波基础流程。

配表：展开右侧“配表与调试”，可下载默认 Excel 模板、导出当前配置、
导入修改后的 .xlsx，并应用重新开始。导入配置刷新后不保留，请及时导出。
动画：展开右侧动画预览面板，选择动画后播放；Esc 可退出预览。
窗口较窄时，向下滚动可找到这些面板。

本版本为首轮美术接入 demo；部分特殊攻击机制及 Boss 剧情仍在开发，
动画预览中展示的动画不代表全部已接入战斗触发。
`);
await fs.mkdir(path.join(output, 'licenses'));
for (const [name, source] of [['PHASER-LICENSE.txt', 'node_modules/phaser/LICENSE.md'], ['XLSX-LICENSE.txt', 'node_modules/xlsx/LICENSE']]) {
  await fs.copyFile(path.join(root, source), path.join(output, 'licenses', name));
}
console.log(output);
