import { render, screen } from "@testing-library/react";
import App from "../../src/App";

describe("App", () => {
  it("renders the boot screen", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /application scaffold is running/i })).toBeVisible();
  });
});
