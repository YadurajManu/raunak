import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "baileys";
import { db } from "@/server/db/client";
import type { SessionRecord } from "@raunak/wa-contracts";
import { decryptState, encryptState } from "../security";

export async function postgresAuth(
  session: SessionRecord,
  assertOwned: () => Promise<void>,
  secret: string,
) {
  const saved: {
    creds: AuthenticationCreds;
    keys: Record<string, Record<string, unknown>>;
  } = session.authStateEnc
    ? JSON.parse(
        decryptState(session.authStateEnc, secret, session.id),
        BufferJSON.reviver,
      )
    : { creds: initAuthCreds(), keys: {} };
  let version = session.authVersion,
    tail = Promise.resolve(),
    timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false,
    onError: () => void = () => {};
  function persist() {
    if (closed) return Promise.reject(new Error("Auth state is closed"));
    const snapshot = JSON.stringify(saved, BufferJSON.replacer);
    const next = tail.then(async () => {
      await assertOwned();
      const changed = await db.whatsAppSession.updateMany({
        where: { id: session.id, authVersion: version },
        data: {
          authStateEnc: encryptState(snapshot, secret, session.id),
          authVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new Error("Auth version changed");
      version++;
    });
    tail = next;
    return next;
  }
  const state: AuthenticationState = {
    creds: saved.creds,
    keys: {
      async get<T extends keyof SignalDataTypeMap>(type: T, ids: string[]) {
        const result: Record<string, SignalDataTypeMap[T]> = {};
        for (const id of ids) {
          let value = saved.keys[type]?.[id];
          if (value !== undefined && value !== null) {
            if (type === "app-state-sync-key")
              value = proto.Message.AppStateSyncKeyData.create(
                value as proto.Message.IAppStateSyncKeyData,
              );
            result[id] = value as SignalDataTypeMap[T];
          }
        }
        return result;
      },
      async set(data: SignalDataSet) {
        if (closed) throw new Error("Auth state is closed");
        for (const [type, entries] of Object.entries(data)) {
          const bucket = (saved.keys[type] ||= {});
          for (const [id, value] of Object.entries(entries || {})) {
            if (value == null) delete bucket[id];
            else bucket[id] = value;
          }
        }
        await persist().catch((error) => {
          onError();
          throw error;
        });
      },
    },
  };
  return {
    state,
    onError(handler: () => void) {
      onError = handler;
    },
    update(creds: Partial<AuthenticationCreds>) {
      if (closed) return;
      Object.assign(saved.creds, creds);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void persist().catch(onError);
      }, 40);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        await persist();
      }
      await tail;
    },
    async close(discard = false) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        if (!discard) await persist();
      }
      closed = true;
      await tail;
    },
  };
}
