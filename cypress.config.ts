import {defineConfig} from "cypress"

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: 'test/integration/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'test/integration/support/e2e.ts',
    screenshotsFolder: 'test/integration/screenshots'
  },
})
