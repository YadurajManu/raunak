"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { localEventTimeToUtc } from "@/lib/dates";
import { formatInr, parseInrToPaise } from "@/lib/money";

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
  types,
}: {
  eventId: string;
  timezone: string;
  types: TicketType[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setError("");
    const formElement = event.currentTarget;
    try {
      const data = new FormData(event.currentTarget);
      const body = {
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
      };
      const response = await fetch(
        id
          ? `/api/events/${eventId}/ticket-types/${id}`
          : `/api/events/${eventId}/ticket-types`,
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not save ticket type.",
        );
      setEditing(null);
      formElement.reset();
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save ticket type.",
      );
    }
  }
  async function remove(id: string) {
    if (!confirm("Delete this ticket type?")) return;
    const response = await fetch(`/api/events/${eventId}/ticket-types/${id}`, {
      method: "DELETE",
    });
    if (response.ok) router.refresh();
    else
      setError(
        (await response.json()).error || "Could not delete ticket type.",
      );
  }
  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section>
        <h2 className="text-xl font-semibold">Ticket types</h2>
        {types.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
            No ticket types yet. Add one to get ready for publishing.
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {types.map((type) => (
              <li
                key={type.id}
                className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
              >
                {editing === type.id ? (
                  <TicketForm
                    type={type}
                    save={(event) => save(event, type.id)}
                    cancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="flex justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{type.name}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {type.description}
                        </p>
                      </div>
                      <span className="font-semibold">
                        {formatInr(type.pricePaise)}
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-zinc-500">
                      {type.quantitySold} sold · {type.quantityHeld} held ·{" "}
                      {type.quantityTotal -
                        type.quantitySold -
                        type.quantityHeld}{" "}
                      available{type.isHidden ? " · Hidden" : ""}
                    </p>
                    <div className="mt-5 flex gap-4 text-sm">
                      <button
                        onClick={() => setEditing(type.id)}
                        className="text-indigo-600 dark:text-indigo-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(type.id)}
                        className="text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-xl font-semibold">Add ticket type</h2>
        <div className="mt-5 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <TicketForm save={(event) => save(event)} />
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-600 lg:col-span-2">
          {error}
        </p>
      )}
    </div>
  );
}

function TicketForm({
  type,
  save,
  cancel,
}: {
  type?: TicketType;
  save(event: React.FormEvent<HTMLFormElement>): void;
  cancel?(): void;
}) {
  const input =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
  return (
    <form onSubmit={save} className="space-y-4">
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
      <label className="block text-sm font-medium">
        Sale starts
        <input
          name="saleStartsAt"
          type="datetime-local"
          defaultValue={type?.saleStartsAt || ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-medium">
        Sale ends
        <input
          name="saleEndsAt"
          type="datetime-local"
          defaultValue={type?.saleEndsAt || ""}
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
        <button className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white">
          {type ? "Save" : "Add ticket"}
        </button>
        {cancel && (
          <button type="button" onClick={cancel} className="text-sm">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
