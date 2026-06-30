const { spawn } = require('child_process');

function getTools() {
  return new Promise((resolve, reject) => {
    console.log("Starting chrome-devtools-mcp...");
    const child = spawn("npx", ["-y", "chrome-devtools-mcp@latest"], {
      env: { ...process.env }
    });
    
    let stdoutData = '';
    let stderrData = '';
    let step = 0; // 0: before init, 1: init sent, 2: initialized sent
    
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Timeout waiting for response from chrome-devtools-mcp"));
    }, 15000);
    
    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
      try {
        const lines = stdoutData.split('\n');
        for (const line of lines) {
          if (!line.trim().startsWith('{')) continue;
          const msg = JSON.parse(line.trim());
          
          if (step === 1 && msg.id === 1) {
            const initializedNotification = {
              jsonrpc: '2.0',
              method: 'notifications/initialized'
            };
            child.stdin.write(JSON.stringify(initializedNotification) + '\n');
            
            step = 2;
            const listRequest = {
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/list',
              params: {}
            };
            child.stdin.write(JSON.stringify(listRequest) + '\n');
          } else if (step === 2 && msg.id === 2) {
            clearTimeout(timer);
            resolve(msg.result.tools);
            child.kill();
            return;
          }
        }
      } catch (e) {
        // incomplete JSON
      }
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with code ${code}. Stderr: ${stderrData}`));
    });

    step = 1;
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'inspector', version: '1.0.0' }
      }
    };
    child.stdin.write(JSON.stringify(initRequest) + '\n');
  });
}

getTools()
  .then(tools => {
    console.log(JSON.stringify(tools, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
