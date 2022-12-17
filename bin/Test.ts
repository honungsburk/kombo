// import { apiClient } from "@japa/api-client";
import { expect } from "@japa/expect";
import { specReporter } from "@japa/spec-reporter";
// import { runFailedTests } from "@japa/run-failed-tests";
import { processCliArgs, configure, run } from "@japa/runner";

/*
|--------------------------------------------------------------------------
| Configure tests
|--------------------------------------------------------------------------
|
| The configure method accepts the configuration to configure the Japa
| tests runner.
|
| The first method call "processCliArgs" process the command line arguments
| and turns them into a config object. Using this method is not mandatory.
|
| Please consult japa.dev/runner-config for the config docs.
*/
configure({
  ...processCliArgs(process.argv.slice(2)),
  ...{
    files: ["src/**/*.spec.ts"],
    plugins: [expect()], //runFailedTests()], //, apiClient("http://localhost:3333")],
    // @ts-ignore
    importer: (filePath: any) => import(filePath),
    reporters: [specReporter()],
  },
});

/*
|--------------------------------------------------------------------------
| Run tests
|--------------------------------------------------------------------------
|
| The following "run" method is required to execute all the tests.
|
*/
run();
