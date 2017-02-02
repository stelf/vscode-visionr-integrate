// visionr integration. 
// by g.penkov @ plan-vision.com
// this code is opensource
// CC - No Attribution

const vscode = require('vscode')
const spawn = require('child_process').spawn

const config = {
  visionr: {
    vshpath: 'vsh',
    username: 'admin',
    password: 'plan4vision',
    servkey: 'UPDATE'
  }
}

function waitExec (vsh, command) {
  return new Promise((res, rej) => {
    console.log('waitExec: bind to subprocess events and expect.')
    let cmdsent = false

    vsh.stdout.on('data', vshdata => {
      console.log(`waitExec: ${vshdata}`)
      let vshline = vshdata.toString()

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

function sendXMLOBJ (xmldata) {
  return new Promise((res, rej) => {
    let vsh = spawn(config.visionr.vshpath, ['localhost:8182',
      '-t', 'xmlobject',
      '-u', config.visionr.username,
      '-p', config.visionr.password,
      '-k', config.visionr.servkey])

    vscode.window.setStatusBarMessage('sendReloadCore: sending XML object')
    vsh.on('data', data => console.log(data));

    waitExec(vsh, xmldata)
      .then(() => {
        vscode.window.setStatusBarMessage('sendXMLOBJ: data sent')
        vscode.window.showInformationMessage('XML Object sent.')
        res('XML object sent!')
      })
      .catch((e) => rej(e))
  })
}

function sendSCHEMA (sxml) {
  return new Promise((res, rej) => {
    let vsh = spawn(config.visionr.vshpath, ['localhost:8182',
      '-t', 'xml',
      '-u', config.visionr.username,
      '-p', config.visionr.password,
      '-k', config.visionr.servkey])

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

function sendReloadCore () {
  return new Promise((res, rej) => {
    let vsh = spawn('vsh', ['localhost:8182',
      '-t', 'raw',
      '-u', config.visionr.username,
      '-p', config.visionr.password,
      '-k', config.visionr.servkey])

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

function uploadProperty () {
  let r, t
  const editor = vscode.window.activeTextEditor
  t = editor.selection.active.line
  let tfnd = false, rfnd = false
  let lcnt = vscode.window.activeTextEditor.document.lineCount
  let buf
  let tags = []

  // figure the objectdef name
  do {
    buf = editor.document.lineAt(t).text
    let tag

    if (tag = buf.match(/\<(\w)+.*?(col)*.*?\>/)) {
      tags.unshift({tag: tag[0], line: t})
    }

    if (tag = buf.match(/\<(\w)+.*?(tbl|copy_from)*.*?\>/)) {
      tags.unshift({tag: tag[0], line: t})
      tfnd = true
    }

    t--
  } while (!tfnd && t > 0)

  // figure only the currently selected property
  if (tfnd) {
    r = tags[1].line
    let res = []

    do {
      buf = editor.document.lineAt(r).text
      res.push(buf)
      if (buf == `<${tags[1].tag}/>`) {
        rfnd = true
      }
    } while (!rfnd && ++r < lcnt)

    if (rfnd) {
      buf = editor.document.lineAt(tags[1].line).text
      res.unshift(buf)
      res.push(`<${tags[1].tag}/>`)

      sendXMLOBJ(res.join('\n')).then(sendReloadCore).then(
        vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
    }
  }
}

function uploadObject () {
  let r, l
  const editor = vscode.window.activeTextEditor
  l = r = editor.selection.active.line
  let lfnd = false, rfnd = false
  let lcnt = vscode.window.activeTextEditor.document.lineCount
  let buf
  let res = [ editor.document.lineAt(editor.selection.active.line).text ]

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
  } while (l >= 0 && r < lcnt && ! (lfnd && rfnd))

  if (lfnd && rfnd) {
    vscode.window.setStatusBarMessage(`found ${rfnd - lfnd} data between ${rfnd} and ${lfnd}`)
    sendXMLOBJ(res.join('\n'))
      .then(sendReloadCore)
      .then(vscode.window.showInformationMessage.bind(this, 'Upload to VISIONR Server complete!'))
  } else {
    console.log('could not figure XML object within current VR editor')
  }
}

function activate (context) {
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

function deactivate () {
  console.log('unload VISIONR extension')
}
exports.deactivate = deactivate
