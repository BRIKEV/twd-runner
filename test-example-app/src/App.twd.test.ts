import { twd, userEvent, screenDom } from "twd-js";
import { describe, it, beforeEach } from "twd-js/runner";

describe("App Component", () => {
  beforeEach(async () => {
    await twd.visit("/");
  });

  it("should render the main heading", async () => {
    const heading = screenDom.getByRole("heading", { level: 1 });
    twd.should(heading, "be.visible");
    twd.should(heading, "have.text", "Vite + React");
  });

  it("should handle button clicks and increment counter", async () => {
    const user = userEvent.setup();
    const button = screenDom.getByRole("button", { name: /count is/i });

    twd.should(button, "have.text", "count is 0");

    await user.click(button);
    twd.should(button, "have.text", "count is 1");

    await user.click(button);
    twd.should(button, "have.text", "count is 2");
  });

  it("should display the logos", async () => {
    const viteLogo = screenDom.getByAltText("Vite logo");
    const reactLogo = screenDom.getByAltText("React logo");

    twd.should(viteLogo, "be.visible");
    twd.should(reactLogo, "be.visible");
  });
});
