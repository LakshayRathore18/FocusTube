import { configure } from "@testing-library/react";
import { vi } from "vitest";

configure({ asyncUtilTimeout: 3000 });
window.scrollTo = vi.fn();
