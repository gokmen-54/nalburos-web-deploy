/* cPanel/Passenger compatible startup file for Next.js */
const http = require("http");
const next = require("next");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => {
        handle(req, res);
      })
      .listen(port, host, () => {
        // eslint-disable-next-line no-console
        console.log(`NalburOS web server running on http://${host}:${port}`);
      });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Server startup failed:", error);
    process.exit(1);
  });
