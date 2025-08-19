const { spawn } = require('child_process');

console.log("Starting sharp installation fix...");

const install = spawn('npm', ['install', '--os=linux', '--cpu=arm64', 'sharp', '--include=optional']);

install.stdout.on('data', data => process.stdout.write(data));
install.stderr.on('data', data => process.stderr.write(data));

install.on('close', code => {
  console.log(`sharp install process exited with code ${code}`);
  console.log("Starting npm start...");

  const start = spawn('npm', ['start']);

  start.stdout.on('data', data => process.stdout.write(data));
  start.stderr.on('data', data => process.stderr.write(data));

  start.on('close', code => {
    console.log(`npm start process exited with code ${code}`);
  });
});

