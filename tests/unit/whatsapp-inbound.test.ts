import { expect, it } from "vitest";
import { command } from "../../services/wa-gateway/src/inbound";
it("recognizes only explicit opt-out and ticket commands", () => {
  for (const text of [
    "STOP",
    "unsubscribe!",
    "band",
    "Band karo",
    "बंद करो।",
    "rok do",
  ])
    expect(command(text)).toBe("STOP");
  for (const text of ["ticket", "My Ticket"])
    expect(command(text)).toBe("TICKET");
  for (const text of [
    "please stop by tomorrow",
    "send tickets to another person",
    "hello",
  ])
    expect(command(text)).toBe("OTHER");
});
