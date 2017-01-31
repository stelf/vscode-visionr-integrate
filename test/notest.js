// just an excerpt to test commands

const spawn = require('child_process').spawn;
let vsh = spawn('vsh', ['localhost:8182', '-t', 'xmlobj', '-u', 'admin', '-p', 'plan4vision', '-k', '2017' ]);

vsh.stdout.on('data', (data) => {
    console.log(`vsh stdout: ${data}`);
});

vsh.on('close', (code) => {
    console.log(`vsh child process exited with code ${code}`);
});
