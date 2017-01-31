
const vscode = require('vscode');
const spawn = require('child_process').spawn;

// const PROLOGUE = '<?xml version="1.0" encoding="UTF-8"?>';

const config = {
    visionr: {
        vshpath: 'vsh',
        username: 'admin',
        password: 'plan4vision',
        servkey: 'VISIONR2017'   
    }
}

function waitExec(res, rej, vsh, vshdata, command) {
    console.log(`waitExec: vsh say : ${vshdata}`);
    let vshline = vshdata.toString();

    if (vshline.indexOf('Authentification error') + 1) {
        vscode.window.showErrorMessage(vshline);
        console.error(`sendXMLOBJ: ${vshline}`);
        rej(vshline);        
    } 

    if (vshline.indexOf('ECONNREFUSED') + 1) {
        vscode.window.showErrorMessage(vshline);
        console.error(`sendXMLOBJ: ${vshline}`);
        rej(vshline);
    }

    if (vshline.indexOf('Starting log stream') + 1) {
        vsh.stdin.write(command, 'UTF8', 
            () => vscode.window.setStatusBarMessage('sendXMLOBJ: payload sent'));
        vsh.stdin.end();
    }
}

function sendXMLOBJ(xmldata) {
    return new Promise((res, rej) => {
        let vsh = spawn(config.visionr.vshpath, ['localhost:8182', 
                '-t', 'xmlobject', 
                '-u', config.visionr.username, 
                '-p', config.visionr.password, 
                '-k', config.visionr.servkey]);

        vsh.stdout.on('data', (vshdata) => waitExec(res, rej, vsh, vshdata, xmldata));

        vsh.on('close', (code) => {
            console.log(`sendXMLOBJ: vsh child process exited with code ${code}`);
            if (code == null || code > 0) rej(code); else {
                res(code);
                vscode.window.setStatusBarMessage('sendXMLOBJ: data sent');
                vscode.window.showInformationMessage('VisionR core reloaded.');                
            }
        });
    });
}

function sendReloadCore() {
    return new Promise((res, rej) => {
        let vsh = spawn('vsh', ['localhost:8182', 
                '-t', 'raw', 
                '-u', config.visionr.username, 
                '-p', config.visionr.password, 
                '-k', config.visionr.servkey]);

        vscode.window.setStatusBarMessage('sendReloadCore: reloading core')

        vsh.stdout.on('data', (vshdata) => waitExec(res, rej, vsh, vshdata, 'reload -m core'));

        vsh.on('close', (code) => {
            console.log(`sendXMLOBJ: vsh child process exited with code ${code}`);
            if (code) rej(code); else {
                res(code);
                vscode.window.setStatusBarMessage('sendReloadCore: core reloaded');
                vscode.window.showInformationMessage('VisionR core reloaded.')
            }
        });
    });
}

function processUpload(res) {
    return sendXMLOBJ(res.join('\n')).then(sendReloadCore);
}

function uploadObject() {
    let r, l;
    const editor = vscode.window.activeTextEditor;
    l = r = editor.selection.active.line;
    let lfnd = false, rfnd = false;
    let lcnt = vscode.window.activeTextEditor.document.lineCount;
    let buf;
    let res = [ editor.document.lineAt(editor.selection.active.line).text ];
    
    do { 
        if (!rfnd) {
            buf = editor.document.lineAt(r).text;
            if (buf.indexOf('</object') + 1) {
                rfnd = true;
            } else 
                if (r < lcnt) r++;
        }

        if (!lfnd) {
            buf = editor.document.lineAt(l).text;
            if (buf.indexOf('<object') + 1) {
                lfnd = true;
            } else 
                if (l > 0) l--;
        }

        // consume result on the go
        if (l != r) {
            if (!rfnd) res.push(editor.document.lineAt(r).text);
            if (!lfnd) res.unshift(editor.document.lineAt(l).text);
        }

    } while(l >= 0 && r < lcnt && ! (lfnd && rfnd));

    if (lfnd && rfnd) {
        vscode.window.setStatusBarMessage(`found ${rfnd - lfnd} data between ${rfnd} and ${lfnd}`);
        processUpload(res);
    } else {
        console.log("not found");
    }
    vscode.window.showInformationMessage('Upload to VISIONR Server complete!');
}

function activate(context) {
    console.log('VISIONR integration started!');

    let cmdupload = vscode.commands.registerCommand('visionr.uploadObject', uploadObject);
    let cmdreload = vscode.commands.registerCommand('visionr.reloadCore', sendReloadCore);

    context.subscriptions.push(cmdupload);
    context.subscriptions.push(cmdreload);
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
    console.log('unload VISIONR extension');
}
exports.deactivate = deactivate;