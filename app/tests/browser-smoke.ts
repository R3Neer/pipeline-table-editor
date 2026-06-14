import { startSmokeApp } from "./smoke/browserApp";
import { runEditorSmokeScenario } from "./smoke/scenarios/editorSmokeScenario";

const smokeApp = await startSmokeApp();

try {
  await runEditorSmokeScenario(smokeApp.page, smokeApp.appUrl);
  console.log("Browser smoke test passed");
} finally {
  await smokeApp.close();
}

