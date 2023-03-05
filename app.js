const App = require("./calculateCommissions");
const arch = require("node:process");
App.calculateCommissions(arch.argv[arch.argv.length - 1]);
