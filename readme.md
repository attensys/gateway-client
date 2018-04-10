# Attensys gateway client

```js
const Gateway = require("attensys-gateway-client");

const server = new Gateway({
  host: "localhost:7080"
});

server
  .subscribe({
    topic: "*/node/**"
  })
  .on({
    message: message => {
      console.log(message);
    }
  });
```
