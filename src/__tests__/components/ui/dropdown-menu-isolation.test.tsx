import { Button } from "@nocoo/basalt";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

async function openMenu() {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Open menu">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Menu action</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Open menu" }));
  expect(await screen.findByRole("menuitem", { name: "Menu action" })).toBeInTheDocument();
}

// Deliberately leave menus open at test end: the environment must unmount them
// without leaving viewport focus that closes the next test's menu.
describe("dropdown menu test isolation", { concurrent: false }, () => {
  test("opens a menu with a real primary-button interaction", async () => {
    await openMenu();
  });

  test("opens the next menu after the previous test unmounts", async () => {
    await openMenu();
  });

  test("still dismisses the active menu on genuine window blur", async () => {
    await openMenu();
    fireEvent(window, new FocusEvent("blur"));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
