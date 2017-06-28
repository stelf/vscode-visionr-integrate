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
      console.log(`waitExec: ${vshdata}`)
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
        .catch(vscode.window.showErrorMessage.bind(this));
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

function uploadProperty() {
  let r, t
  const editor = vscode.window.activeTextEditor
  let lcnt = vscode.window.activeTextEditor.document.lineCount
  let tags = []

  r = t = editor.selection.active.line

  // core properties  
  const cprop = [
    'category',
    'data_source',
    'data_type',
    'index_code',
    'is_inmaintbl',
    'is_multiple',
    'is_obligatory',
    'relation_filter',
    'relation_parent',
    'related_objectdef',
    'sort_id',
  ];

  // 1) figure property content
  let level = false;
  let propname;

  do {
    let buf = editor.document.lineAt(t).text;
    let tag;

    if (tag = buf.match(/<(\/[\w_]+)>/)) level = false;
        
    if (tag = buf.match(/<([\w_]+)>.*<\/\1>/)) {
      if (cprop.indexOf(tag[1]) >= 0) {
        level = true;
      }
    } else if (tag = buf.match(/^\s*<([\w_]+).*?(col=".*?")*>\s*$/)) {
      if (level) {
        propname = tag[1];
        console.log(`uploadProperty: found <${propname}> property start, at line ${t}`);
      }
    } else {
      level = false;
    }

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

    if (tag = buf.match(/\<([\w_]+)\s*\b(tbl|copy_from)+.*\>/)) {
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
  let i = 0;
  let module;
  do {
    let buf = editor.document.lineAt(i).text
    let test
    if (test = buf.match(/<(\w+) module_alias.*>/)) {
      module = test[1];
      tags.unshift({
        text: buf,
        line: i
      });
    }

    i++;
  } while (!module);

  // 5) Epilogue

  tags.push(
    { text: `</${objectdef}>` },
    { text: `</${module}>` }
  );

  editor.selection.start.line = t;
  editor.selection.start.character = 1;
  editor.selection.end.line = r + 1;
  editor.selection.end.character = 1;

  let payload = "<objectdefs>" + tags.map(e => e.text).join('\n') + "</objectdefs>";

  sendSCHEMA(payload).then(sendReloadCore).then(
    vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
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
      } else if (l > 0) l--
    }

    // consume result on the go
    if (l != r) {
      if (!rfnd) res.push(editor.document.lineAt(r).text)
      if (!lfnd) res.unshift(editor.document.lineAt(l).text)
    }
  } while (l >= 0 && r < lcnt && !(lfnd && rfnd))

  if (lfnd && rfnd) {
    vscode.window.setStatusBarMessage(`found ${r - l} lines long object between rows ${r} and ${l}`)
    sendXMLOBJ(res.join('\n'))
      .then(sendReloadCore)
      .then(vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
      .catch(vscode.window.showErrorMessage.bind(this))
  } else {
    console.log('could not figure XML object within current VR editor')
  }
}

function activate(context) {
  console.log('VISIONR integration started!')

  const cmds = {
    'visionr.uploadObject': uploadObject,
    'visionr.reloadCore': sendReloadCore,
    'visionr.uploadProperty': uploadProperty,
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
