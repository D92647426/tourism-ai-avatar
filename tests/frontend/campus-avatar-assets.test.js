// REQ-065 / TEST-065: validate generated rigs with the actual vendored runtime.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../../src/main/resources/static');
const runtime = vm.createContext({TextEncoder,TextDecoder,URL,Blob,structuredClone});
vm.runInContext(fs.readFileSync(path.join(root,'vendor/ruic2d/mesh-avatar.js'),'utf8'),runtime);

test('all contextual and default bindings satisfy the real RuiC-2D schema',()=>{
    for (const outfit of ['overalls','hoodie','tshirt']) {
        const folders = ['media/campus/yanxiaobei-v8/'+outfit,
            ...['study','dining','thinking','hungry'].map(pose=>'media/campus/yanxiaobei-actions/'+outfit+'/'+pose)];
        for (const folder of folders) {
            const rig = JSON.parse(fs.readFileSync(path.join(root,folder,'rig.json'),'utf8'));
            assert.doesNotThrow(()=>runtime.MeshAvatar.parseRig(rig),folder);
        }
    }
});
