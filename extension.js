// visionr integration. 
// by g.penkov @ plan-vision.com
// this code is opensource
// CC - No Attribution

const vscode = require('vscode')
const spawn = require('child_process').spawn

const vshpath = vscode.workspace.getConfiguration('visionr').get('vshpath');

function waitExec(vsh, command) {
  return new Promise((res, rej) => {
    console.log('waitExec: bind to subprocess events and expect.')
    let cmdsent = false

    vsh.stdout.on('data', vshdata => {
      // console.debug(`waitExec: ${vshdata}`)
      let vshline = vshdata.toString()
      let e;

      if (vshline.indexOf('Server stopped') + 1) {
        vscode.window.showErrorMessage(vshline)
        console.error(`waitExec: ${vshline}`)
        return rej(vshline)
      }

      if (vshline.indexOf('Unable to transform simple import file') + 1) {
        vscode.window.showErrorMessage('Error transforming snippet.')
        console.error(`waitExec: ${vshline}`)
        console.info(command)
        return rej(vshline)
      }

      if (e = vshline.match(/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Authentification/)) {
        vscode.window.showErrorMessage(vshline)
        console.error(`waitExec: ${vshline}`)
        return rej(`Connection error:  ${e[0]}`)
      }

      if (vshline.indexOf('Starting log stream') + 1) {
        vsh.stdin.write(command, 'UTF8',
          () => vscode.window.setStatusBarMessage('waitExec: payload sent'))
        vsh.stdin.end()
        cmdsent = true
      }

      if (e = vshline.indexOf('XML import error on line') >= 0) {
        return rej('error importing xml snippet...');
      }

      if (e = vshline.indexOf('error:Error on transformation') >= 0) {
        return rej('error importing xml snippet...');        
      }

      if (e = vshline.indexOf('On validating import xml file') >= 0) {
        return rej('error importing xml snippet...');
      }
    })

    vsh.on('close', code => {
      console.log(`waitExec: vsh child process exited with code ${code}`)
      if (code > 0) return rej(code)
      if (!cmdsent) return rej('command did not went through!')

      res('vsh closed successfully, command went through!')
    })
  })
}

let curep;

function chooseEndpoint() {
  let endpoints = vscode.workspace.getConfiguration('visionr').get('endpoints');

  if (endpoints.length == 1) {
    return Promise.resolve(endpoints[0]);
  }

  if (curep) return Promise.resolve(curep);

  return new Promise(res =>
    vscode.window.showQuickPick(endpoints.map(e => e.name))
    .then(choosen => {
      curep = endpoints.find(e => e.name == choosen);
      res(curep);
    }));
}

function selectEndpoint() {
  curep = undefined;
  return chooseEndpoint();
}

function sendXMLOBJ(xmldata) {
  return new Promise((res, rej) => {
    chooseEndpoint().then(ep => {
      let vsh = spawn(vshpath, [ep.endpoint,
        '-t', 'xmlobject',
        '-u', ep.username, '-p', ep.password, '-k', ep.servkey
      ])

      vscode.window.setStatusBarMessage(`sendReloadCore: sending XML object to ${ep.endpoint}`)
      // vsh.on('data', data => console.log(data));

      waitExec(vsh, xmldata)
        .then(() => {
          vscode.window.setStatusBarMessage(`sendXMLOBJ: data => ${ep.endpoint} (${ep.servkey})`)
  //          vscode.window.showInformationMessage(`XML Object sent to ${ep.endpoint}`)
          res('XML object sent!')
        })
        .catch(vscode.window.showErrorMessage.bind(this));
    })
  });
}

function sendSCHEMA(sxml) {
  return new Promise((res, rej) => {
    chooseEndpoint().then(ep => {
      let vsh = spawn(vshpath, [ep.endpoint,
        '-t', 'xml',
        '-u', ep.username, '-p', ep.password, '-k', ep.servkey
      ])

      vscode.window.setStatusBarMessage('sendReloadCore: sending SCHEMA')

      return waitExec(vsh, sxml)
        .then(() => {
          vscode.window.showInformationMessage('XML SCHEMA update sent.', ep.servkey)
          res('VR XML Schema sent!')
        })
        .catch( err => { 
          vscode.window.showErrorMessage(err)
          console.warn(sxml)
        });
    })
  })

}

function sendReloadCore() {
  return new Promise((res, rej) => {
    chooseEndpoint().then(ep => {
      let vsh = spawn(vshpath, [ep.endpoint,
        '-t', 'raw',
        '-u', ep.username, '-p', ep.password, '-k', ep.servkey
      ])

      vscode.window.setStatusBarMessage('sendReloadCore: reloading core')

      waitExec(vsh, 'reload -m core')
        .then(() => {
          vscode.window.setStatusBarMessage('reloadCore: reload command sent')
          vscode.window.showInformationMessage('Reload triggered.')
          res('VR core reload triggered');
        })
        .catch((e) => { console.log(e); rej(e); });
    })
  });
}

function determineModule(tags) { 
  "use strict"

  console.log(`determineModule: searching for module prologue`);
  
  const editor = vscode.window.activeTextEditor
  const lcnt = vscode.window.activeTextEditor.document.lineCount

  let i = 0

  do {
    let buf = editor.document.lineAt(i).text
    let test
    if (test = buf.match(/<(\w+) module_alias.*>/)) {
      tags.unshift({
        text: buf,
        line: i
      });

      console.log(`determineModule: [${test[1]}] found at line [${i}]`);      
      return test[1]
    }

    i++;
  } while (i < lcnt)
}

function uploadProperty() {
  "use strict"
  let r, t

  const editor = vscode.window.activeTextEditor
  const curdoc = vscode.window.activeTextEditor.document

  let lcnt = curdoc.lineCount
  let tags = []

  r = t = editor.selection.active.line

  // core properties  
  const cprop = [
    'category',
    'data_source',
    'data_type',
    'display_type',
    'index_code',
    'is_constant',
    'is_dynamic',
    'is_hidden',
    'is_inmaintbl',
    'is_multiple',
    'is_obligatory',
    'is_readonly',
    'rel_display_string_order',
    'related_objectdef',
    'relation_filter',
    'relation_parent',
    'sort_id',
  ];

  // 1) figure property content
  let level = false;
  let propname;

  do {
    let buf = editor.document.lineAt(t).text;
    let tag;

    // closing tag - UNSET level 
    if (tag = buf.match(/<^\s*(\/[\w_]+)>/)) {
        level = false;        
    }

    // single opening tag 
    if ((tag = buf.match(/^\s*<([a-z_]+)>/)) && cprop.indexOf(tag[1]) >= 0) {
        level = true;
    }   // opening and closing tag on a single line
    else if ((tag = buf.match(/<([a-z_]+)>.*<\/\1>/)) && cprop.indexOf(tag[1]) >= 0) {
        level = true; 
    } // opening tag - generic for properties    
    else if (tag = buf.match(/^\s*<([a-z_]+)*?\s*((col|is_keep_settings)="\w+")*>\s*$/)) {
      if (level) {
        propname = tag[1];
        console.log(`uploadProperty: found <${propname}> property start, at line ${t}`);  
      }
    } else {
      level = false;
    }

    step:

    tags.unshift({
      text: buf,
      line: t
    });
    t--;
  } while (!propname && t > 0);

  if (!propname) return;

  // 2) figure the objectdef opening tag
  let objectdef;
  let o = t;
  do {
    let tag, buf;
    buf = editor.document.lineAt(o).text

    if (tag = buf.match(/\<([\w_]+)\s*\b(tbl|copy_from|parent_objectdef)+.*\>/)) {
      tags.unshift({
        text: buf,
        line: o
      })
      objectdef = tag[1];
      console.log(`uploadProperty: objectdef is [ ${objectdef} ] located at line ${o}`);
    }

    o--
  } while (!objectdef && o > 0)

  if (!objectdef) return;

  // 3)  figure the end of current property
  // note: counting depth as some property
  // names such as <name> may also appear as tags
  let depth = 1; r++;
  console.log(`uploadProperty: searching for the <${propname}> contents, starting at line ${r}`);
  do {
    let buf = editor.document.lineAt(r).text
    tags.push({
      text: buf,
      line: r
    });

    if (buf.indexOf(`<${propname}>`) >= 0) depth++;
    if (buf.indexOf(`</${propname}`) >= 0) --depth;

    r++;
  } while (depth && r < lcnt)

  if (depth) return;

  // 4) Prologue
  const mod = determineModule(tags);

  // 5) Epilogue

  tags.push(
    { text: `</${objectdef}>` },
    { text: `</${mod}>` }
  );

  editor.selection = new vscode.Selection(
    curdoc.positionAt(t), curdoc.positionAt(r)
  )

  const payload = "<objectdefs>" + tags.map(e => e.text).join('\n') + "</objectdefs>";
  const updpath = `${[mod, objectdef, propname].join('.')}`;
  
  sendSCHEMA(payload).then(sendReloadCore).then(
    vscode.window.showInformationMessage.bind(this, `definition for ${updpath} updated at ${curep.endpoint}`))
}

function deleteProperty() {
  vscode.window.showInputBox({ prompt: 'Enter path to property (eg. db.module.odef.prop)' })
  .then(val => {
    var res = val.match(/db\.(\w+)\.(\w+)\.(\w+)/)
    if (!res) return;

    let tags = []
    let module = determineModule(tags)
    
    tags.push({text: `<${res[3]} mode="delete" />` })

    tags.push(
      { text: `</${objectdef}>` },
      { text: `</${module}>` }
    );

    let payload = "<objectdefs>" + tags.map(e => e.text).join('\n') + "</objectdefs>";    
    vscode.window.showInformationMessage('deleting ' + val)

    sendSCHEMA(payload).then(sendReloadCore).then(
      vscode.window.showInformationMessage.bind(this, `${module}.${objectdef}.${propname} deleted`))
  
  });
}

function uploadObject() {
  let r, l
  const editor = vscode.window.activeTextEditor
  l = r = editor.selection.active.line
  let lfnd = false,
    rfnd = false
  let lcnt = vscode.window.activeTextEditor.document.lineCount
  let buf
  let res = [editor.document.lineAt(editor.selection.active.line).text]

  // find boundaries of object looking for opening/closing tags
  do {
    if (!rfnd) {
      buf = editor.document.lineAt(r).text
      if (buf.indexOf('</object') >= 0 && buf.indexOf('<object>') == -1) {
        rfnd = true
      } else if (r < lcnt) r++
    }

    if (!lfnd) {
      buf = editor.document.lineAt(l).text
      if (buf.indexOf('<object') >= 0 && buf.indexOf('/>') == -1 && buf.indexOf('/object>') == -1) {
        lfnd = true
        buf.match(/code="([_\w]+)"/);
      } else if (l > 0) l--
    }

    // consume result on the go
    if (l != r) {
      if (!rfnd) res.push(editor.document.lineAt(r).text)
      if (!lfnd) res.unshift(editor.document.lineAt(l).text)
    }
  } while (l >= 0 && r < lcnt && !(lfnd && rfnd))

  if (lfnd && rfnd) { stChangedRevision: 1
    vscode.window.activeTextEditor.selections[0] = new vscode.Selection(
      editor.document.positionAt(l), 
      editor.document.positionAt(r)
    )
  
    vscode.window.setStatusBarMessage(`found ${r - l} lines long object between rows ${l} and ${r}`)
    sendXMLOBJ(res.join('\n'))
      .then(sendReloadCore)
      .then(vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
      .catch(vscode.window.showErrorMessage.bind(this))
  } else {
    let msg = 'could not figure XML object within current VR editor';
    vscode.window.showErrorMessage(msg)
    console.log(msg)
  }
}
 
function activate(context) {
  console.log('VISIONR integration started!')

  const cmds = {
    'visionr.uploadObject': uploadObject,
    'visionr.reloadCore': sendReloadCore,
    'visionr.uploadProperty': uploadProperty,
    'visionr.deleteProperty': deleteProperty,
    'visionr.selectEndpoint': selectEndpoint
  }

  for (var code in cmds) {
    console.log(`registering: command ${code}`)
    let cmd = vscode.commands.registerCommand(code, cmds[code])
    context.subscriptions.push(cmd)
  }

//   var s1 = vscode.languages.registerCodeLensProvider('xml', {
//       provideCodeLenses: (doc, ct) => {
//           console.log('init objectlens provider'); 
//           var codeLenses = [];
          
//           codeLenses.push( {
//               range: doc.lineAt(0).range,
//               command: { title: 'Foo', command: 'extension.sayHello'},
//               isResolved: true
//           });

//           return codeLenses;
//       },

// // 1. historization

// // 2. default columns
// // 2a. create new 

// // 3. excel multi print

// // 4. weeks on stock

//       resolveCodeLens: (cl, tkn) => {

//           return cl;
//       }

//   });

}

exports.activate = activate

function deactivate() {
  console.log('unload VISIONR extension')
}
exports.deactivate = deactivate
