import { getAdminDb } from "@/infrastructure/firebase/admin";
import type { DecisionRecord } from "@/domain/decision/types";
import type { Blueprint, ExperimentDefinition } from "@/domain/blueprint/types";
import type {
  BlueprintRepository,
  DecisionRecordRepository,
  ExperimentRepository,
  IdempotencyStore,
  RateLimitStore,
} from "@/domain/repositories";
import { AppError } from "@/infrastructure/api/errors";

export class FirestoreDecisionRecordRepository
  implements DecisionRecordRepository
{
  private col() {
    return getAdminDb().collection("decisionRecords");
  }

  async create(
    input: Omit<DecisionRecord, "id"> & { id?: string }
  ): Promise<DecisionRecord> {
    const ref = input.id ? this.col().doc(input.id) : this.col().doc();
    const record: DecisionRecord = { ...input, id: ref.id };
    await ref.set(record);
    return record;
  }

  async getById(id: string, ownerId: string): Promise<DecisionRecord | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as DecisionRecord;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }

  async getBySession(
    sessionId: string,
    ownerId: string
  ): Promise<DecisionRecord | null> {
    const snap = await this.col()
      .where("sessionId", "==", sessionId)
      .where("ownerId", "==", ownerId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { ...(d.data() as DecisionRecord), id: d.id };
  }
}

export class FirestoreBlueprintRepository implements BlueprintRepository {
  private col() {
    return getAdminDb().collection("blueprints");
  }

  async create(
    input: Omit<Blueprint, "id"> & { id?: string }
  ): Promise<Blueprint> {
    const ref = input.id ? this.col().doc(input.id) : this.col().doc();
    const bp: Blueprint = { ...input, id: ref.id };
    await ref.set(bp);
    return bp;
  }

  async getById(id: string, ownerId: string): Promise<Blueprint | null> {
    const snap = await this.col().doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Blueprint;
    if (data.ownerId !== ownerId) return null;
    return { ...data, id: snap.id };
  }

  async getBySession(
    sessionId: string,
    ownerId: string
  ): Promise<Blueprint | null> {
    const snap = await this.col()
      .where("sessionId", "==", sessionId)
      .where("ownerId", "==", ownerId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { ...(d.data() as Blueprint), id: d.id };
  }

  async updateStatus(
    id: string,
    ownerId: string,
    status: Blueprint["status"],
    approvedAt?: string
  ): Promise<Blueprint> {
    const existing = await this.getById(id, ownerId);
    if (!existing) throw new AppError("NOT_FOUND", "Blueprint not found", 404);
    const updated = {
      ...existing,
      status,
      approvedAt: approvedAt ?? existing.approvedAt,
    };
    await this.col().doc(id).set(updated);
    return updated;
  }
}

export class FirestoreExperimentRepository implements ExperimentRepository {
  async create(
    input: Omit<ExperimentDefinition, "id">
  ): Promise<ExperimentDefinition> {
    const ref = getAdminDb()
      .collection("workspaces")
      .doc(input.workspaceId)
      .collection("sessions")
      .doc(input.sessionId)
      .collection("experiments")
      .doc();
    const exp: ExperimentDefinition = { ...input, id: ref.id };
    await ref.set(exp);
    return exp;
  }

  async listBySession(
    workspaceId: string,
    sessionId: string
  ): Promise<ExperimentDefinition[]> {
    const snap = await getAdminDb()
      .collection("workspaces")
      .doc(workspaceId)
      .collection("sessions")
      .doc(sessionId)
      .collection("experiments")
      .get();
    return snap.docs.map((d) => ({
      ...(d.data() as ExperimentDefinition),
      id: d.id,
    }));
  }
}

export class FirestoreIdempotencyStore implements IdempotencyStore {
  async get(key: string): Promise<string | null> {
    const snap = await getAdminDb().collection("idempotency").doc(key).get();
    if (!snap.exists) return null;
    return (snap.data() as { artifactId: string }).artifactId;
  }

  async set(key: string, artifactId: string): Promise<void> {
    await getAdminDb().collection("idempotency").doc(key).set({
      artifactId,
      createdAt: new Date().toISOString(),
    });
  }

  async claim(
    key: string,
    artifactId: string
  ): Promise<{ won: boolean; artifactId: string }> {
    const ref = getAdminDb().collection("idempotency").doc(key);
    try {
      // create() fails atomically if the doc already exists — no
      // read-then-write window like get()+set() has.
      await ref.create({ artifactId, createdAt: new Date().toISOString() });
      return { won: true, artifactId };
    } catch (error) {
      const err = error as { code?: number };
      if (err.code === 6 /* ALREADY_EXISTS */) {
        const snap = await ref.get();
        const existing = (snap.data() as { artifactId: string } | undefined)
          ?.artifactId;
        if (existing) return { won: false, artifactId: existing };
      }
      throw error;
    }
  }
}

export class FirestoreRateLimitStore implements RateLimitStore {
  async consume(
    uid: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const db = getAdminDb();
    const ref = db.collection("rateLimits").doc(`ai-run:${uid}`);
    const now = Date.now();
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const stamps = (
        (snap.exists ? (snap.data() as { stamps: number[] }).stamps : []) ?? []
      ).filter((t) => now - t < windowMs);
      if (stamps.length >= limit) {
        tx.set(ref, { stamps });
        return { allowed: false, remaining: 0 };
      }
      stamps.push(now);
      tx.set(ref, { stamps });
      return { allowed: true, remaining: limit - stamps.length };
    });
  }
}
