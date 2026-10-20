import { connectDB } from '@/lib/db';
import { TimeLog } from '@/server/models/TimeLog';
import { Step } from '@/server/models/Step';

export async function startTimeLog(userId: string, stepId: string, missionId?: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  const log = await TimeLog.create({
    userId,
    stepId,
    missionId,
    startedAt: new Date(),
    durationSec: 0,
  });

  return log.toObject();
}

export async function stopTimeLog(userId: string, logId: string, durationSec: number) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!logId) throw new Error('logId is required');
  await connectDB();

  const now = new Date();
  const updatedLog = await TimeLog.findOneAndUpdate(
    { _id: logId, userId },
    { $set: { endedAt: now, durationSec } },
    { new: true }
  )
    .lean()
    .exec();

  if (updatedLog) {
    // Add logged duration to step's actualMin
    const additionalMin = Math.round(durationSec / 60);
    if (additionalMin > 0) {
      await Step.findOneAndUpdate(
        { _id: updatedLog.stepId, userId },
        { $inc: { actualMin: additionalMin } }
      ).exec();
    }
  }

  return updatedLog;
}

export async function getTimeLogsByStep(userId: string, stepId: string) {
  if (!userId) throw new Error('Security Error: userId is required');
  if (!stepId) throw new Error('stepId is required');
  await connectDB();

  return await TimeLog.find({ userId, stepId }).sort({ startedAt: -1 }).limit(30).lean().exec();
}
