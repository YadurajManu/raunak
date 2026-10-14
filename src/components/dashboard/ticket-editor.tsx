"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localEventTimeToUtc, utcToLocalEventTime } from "@/lib/dates";
import { formatInr, parseInrToPaise } from "@/lib/money";
import { ticketAvailability } from "@/lib/ticket-availability";
import { MediaDialog } from "./media-dialog";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  quantityTotal: number;
  quantitySold: number;
  quantityHeld: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  minPerOrder: number;
  maxPerOrder: number;
  isHidden: boolean;
};

export function TicketEditor({
  eventId,
  timezone,
  startsAt,
  status,
  types,
}: {
  eventId: string;
  timezone: string;
  startsAt: string;
  status: string;
  types: TicketType[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  function open(id: string) {
    setError("");
    setDirty(false);
    setEditing(id);
  }
  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        id
          ? `/api/events/${eventId}/ticket-types/${id}`
          : `/api/events/${eventId}/ticket-types`,
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: String(data.get("name")),
            description: String(data.get("description")),
            pricePaise: parseInrToPaise(String(data.get("price"))),
            quantityTotal: Number(data.get("quantityTotal")),
            minPerOrder: Number(data.get("minPerOrder")),
            maxPerOrder: Number(data.get("maxPerOrder")),
            saleStartsAt: data.get("saleStartsAt")
              ? localEventTimeToUtc(String(data.get("saleStartsAt")), timezone)
              : null,
            saleEndsAt: data.get("saleEndsAt")
              ? localEventTimeToUtc(String(data.get("saleEndsAt")), timezone)
              : null,
            isHidden: data.get("isHidden") === "on",
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save ticket.");
      setEditing(null);
      setDirty(false);
      setMessage(id ? "Ticket updated." : "Ticket added.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save ticket. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      saving.current ||
      !confirm("Delete this ticket type? Sold tickets cannot be deleted.")
    )
      return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/events/${eventId}/ticket-types/${id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not delete ticket.",
        );
      setMessage("Ticket deleted.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Connection interrupted. Please try again.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="tk-editor">
      <header className="tk-heading">
        <div>
          <h2>
            Ticket types <small>{types.length}</small>
          </h2>
          <p>Clear prices. A simple way in.</p>
        </div>
        <button
          className="m-button m-button-small"
          onClick={() => open("new")}
          disabled={busy}
        >
          ＋ Add ticket type
        </button>
      </header>
      {types.length ? (
        <ul className="tk-list">
          {types.map((type) => {
            const sale = ticketAvailability(
              type,
              startsAt,
              timezone,
              now,
              status,
            );
            return (
              <li key={type.id}>
                <div className="tk-price">
                  {type.pricePaise ? formatInr(type.pricePaise) : "Free"}
                </div>
                <div className="tk-details">
                  <h3>{type.name}</h3>
                  {type.description && <p>{type.description}</p>}
                  <span
                    className={
                      sale.available ? "tk-status is-open" : "tk-status"
                    }
                  >
                    {sale.label}
                  </span>
                  <p>
                    {type.quantitySold} sold · {type.quantityHeld} reserved ·{" "}
                    {sale.remaining} available
                  </p>
                  <small>
                    {type.minPerOrder}–{type.maxPerOrder} per booking
                  </small>
                </div>
                <div className="tk-actions">
                  <button
                    className="r-quiet-button"
                    disabled={busy}
                    onClick={() => open(type.id)}
                    aria-label={`Edit ${type.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="r-quiet-button"
                    disabled={busy}
                    onClick={() => remove(type.id)}
                    aria-label={`Delete ${type.name}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="tk-empty">
          <h3>Your first ticket, your first guest.</h3>
          <p>
            Add a free pass or a paid ticket. You can adjust prices and sale
            dates before publishing.
          </p>
        </div>
      )}
      {error && !editing && (
        <p role="alert" className="m-field-error">
          {error}
        </p>
      )}
      <p role="status" className="tk-feedback">
        {message}
      </p>
      {editing && (
        <MediaDialog
          title={editing === "new" ? "Add ticket type" : "Edit ticket"}
          close={() => {
            if (!busy) setEditing(null);
          }}
          dirty={dirty || busy}
        >
          <TicketForm
            type={types.find((type) => type.id === editing)}
            timezone={timezone}
            busy={busy}
            changed={() => setDirty(true)}
            save={(event) =>
              save(event, editing === "new" ? undefined : editing)
            }
            cancel={() => {
              if (!dirty || confirm("Discard ticket changes?"))
                setEditing(null);
            }}
          />
          {error && (
            <p role="alert" className="m-field-error">
              {error}
            </p>
          )}
        </MediaDialog>
      )}
    </section>
  );
}
function TicketForm({
  type,
  save,
  cancel,
  timezone,
  busy,
  changed,
}: {
  type?: TicketType;
  timezone: string;
  busy: boolean;
  changed(): void;
  save(event: React.FormEvent<HTMLFormElement>): void;
  cancel?(): void;
}) {
  const input =
    "mt-1 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 dark:border-[var(--line)]";
  return (
    <form onSubmit={save} onChange={changed} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">
          Name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={type?.name}
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Description
          <input
            name="description"
            maxLength={1000}
            defaultValue={type?.description || ""}
            className={input}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Price (₹)
            <input
              name="price"
              required
              inputMode="decimal"
              pattern="[0-9]+(\.[0-9]{1,2})?"
              defaultValue={type ? (type.pricePaise / 100).toFixed(2) : "0"}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Quantity
            <input
              name="quantityTotal"
              type="number"
              min={1}
              max={100000}
              required
              defaultValue={type?.quantityTotal || 100}
              className={input}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Min per order
            <input
              name="minPerOrder"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={type?.minPerOrder || 1}
              className={input}
            />
          </label>
          <label className="block text-sm font-medium">
            Max per order
            <input
              name="maxPerOrder"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={type?.maxPerOrder || 10}
              className={input}
            />
          </label>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Sale times are in {timezone}. Leave blank to open sales immediately
          and close when the event starts.
        </p>
        <label className="block text-sm font-medium">
          Sale starts
          <input
            name="saleStartsAt"
            type="datetime-local"
            defaultValue={
              type?.saleStartsAt
                ? utcToLocalEventTime(type.saleStartsAt, timezone)
                : ""
            }
            className={input}
          />
        </label>
        <label className="block text-sm font-medium">
          Sale ends
          <input
            name="saleEndsAt"
            type="datetime-local"
            defaultValue={
              type?.saleEndsAt
                ? utcToLocalEventTime(type.saleEndsAt, timezone)
                : ""
            }
            className={input}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            name="isHidden"
            type="checkbox"
            defaultChecked={type?.isHidden}
          />
          Hide from public ticket list
        </label>
        <div className="flex gap-3">
          <button className="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-white">
            {busy ? "Saving…" : type ? "Save" : "Add ticket"}
          </button>
          {cancel && (
            <button type="button" onClick={cancel} className="text-sm">
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
