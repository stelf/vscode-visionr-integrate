// visionr integration. 
// by g.penkov @ plan-vision.com
// this code is opensource
// CC - No Attribution

const vscode = require('vscode')
const spawn = require('child_process').spawn

const vshpath =  vscode.workspace.getConfiguration('visionr').get('vshpath');

function waitExec(vsh, command) {
  return new Promise((res, rej) => {
    console.log('waitExec: bind to subprocess events and expect.')
    let cmdsent = false

    vsh.stdout.on('data', vshdata => {
      console.log(`waitExec: ${vshdata}`)
      let vshline = vshdata.toString()

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



      if (vshline.indexOf('Authentification error') + 1) {
        vscode.window.showErrorMessage(vshline)
        console.error(`waitExec: ${vshline}`)
        return rej(vshline)
      }

      if (vshline.indexOf('ECONNREFUSED') + 1) {
        vscode.window.showErrorMessage(vshline)
        console.error(`waitExec: ${vshline}`)
        return rej(vshline)
      }

      if (vshline.indexOf('EAI_AGAIN') + 1) {
        vscode.window.showErrorMessage(vshline)
        console.error(`waitExec: ${vshline}`)
        return rej(vshline)
      }

      if (vshline.indexOf('Starting log stream') + 1) {
        vsh.stdin.write(command, 'UTF8',
          () => vscode.window.setStatusBarMessage('waitExec: payload sent'))
        vsh.stdin.end()
        cmdsent = true
      }
    })

    vsh.on('close', code => {
      console.log(`waitExec: vsh child process exited with code ${code}`)
      if (code > 0) rej(code)
      if (!cmdsent) rej('command did not went through!')

      res('vsh closed successfully, command went through!')
    })
  })
}

function chooseEndpoint() {
  let endpoints = vscode.workspace.getConfiguration('visionr').get('endpoints');

  if (endpoints.length > 1) {
    //TODO: dropdown
  } else 
    return endpoints[0];
}

function sendXMLOBJ(xmldata) {
  return new Promise((res, rej) => {
    let ep = chooseEndpoint();
    let vsh = spawn(vshpath, [ep.endpoint,
      '-t', 'xmlobject',
      '-u', ep.username, '-p', ep.password, '-k', ep.servkey
    ])

    vscode.window.setStatusBarMessage('sendReloadCore: sending XML object')
    vsh.on('data', data => console.log(data));

    waitExec(vsh, xmldata)
      .then(() => {
        vscode.window.setStatusBarMessage('sendXMLOBJ: data sent')
        vscode.window.showInformationMessage('XML Object sent.')
        res('XML object sent!')
      })
      .catch((e) => (console.log(e)) || Promise.resolve(true));
  })
}

function sendSCHEMA(sxml) {
  return new Promise((res, rej) => {
    let ep = chooseEndpoint();
    let vsh = spawn(vshpath, [ep.endpoint,
      '-t', 'xml',
      '-u', ep.username, '-p', ep.password, '-k', ep.servkey
    ])

    vscode.window.setStatusBarMessage('sendReloadCore: sending SCHEMA')

    waitExec(vsh, sxml)
      .then(() => {
        vscode.window.setStatusBarMessage('sendSCHEMA: data sent')
        vscode.window.showInformationMessage('XML SCHEMA sent.')
        res('VR XML Schema sent!')
      })
      .catch(e => rej(e))
  })
}

function sendReloadCore() {
  return new Promise((res, rej) => {
    let ep = chooseEndpoint();
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
      .catch(e => rej(e))
  })
}

function uploadProperty() {
  let r, t
  const editor = vscode.window.activeTextEditor
  let lcnt = vscode.window.activeTextEditor.document.lineCount
  let tags = []

  r = t = editor.selection.active.line

  // core properties  
  const cprop = [
    'is_obligatory',
    'is_multiple',
    'sort_id',
    'category',
    'data_source',
    'relation_parent',
    'is_inmaintbl',
    'relation_filter'
  ];

  // 1) figure property content
  let level = false;
  let propname;

  do {
    let buf = editor.document.lineAt(t).text;
    let tag;

    if (tag = buf.match(/<([\w_]+)>.*<\/\1>/)) {
      if (cprop.indexOf(tag[1]) >= 0) {
        level = true;
      }
    } else if (tag = buf.match(/^\s*<([\w_]+)>\s*$/)) {
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

    if (tag = buf.match(/\<(\w+)\s*\b(tbl|copy_from)+.*\>/)) {
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
  let depth = 1;
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

  editor.selection.start.line = t;
  editor.selection.start.character = 1;
  editor.selection.end.line = r + 1;
  editor.selection.end.character = 1;

  let payload = tags.map(e => e.text).join('\n')

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
      if (buf.indexOf('</object') + 1) {
        rfnd = true
      } else if (r < lcnt) r++
    }

    if (!lfnd) {
      buf = editor.document.lineAt(l).text
      if (buf.indexOf('<object') + 1) {
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
    vscode.window.setStatusBarMessage(`found ${rfnd - lfnd} data between ${rfnd} and ${lfnd}`)
    sendXMLOBJ(res.join('\n'))
      .then(sendReloadCore)
      .then(vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
  } else {
    console.log('could not figure XML object within current VR editor')
  }
}

function activate(context) {
  console.log('VISIONR integration started!')

  const cmds = {
    'visionr.uploadObject': uploadObject,
    'visionr.reloadCore': sendReloadCore,
    'visionr.uploadProperty': uploadProperty
  }

  for (var code in cmds) {
    console.log(`registering: command ${code}`)
    let cmd = vscode.commands.registerCommand(code, cmds[code])
    context.subscriptions.push(cmd)
  }
}

exports.activate = activate

function deactivate() {
  console.log('unload VISIONR extension')
}
exports.deactivate = deactivate