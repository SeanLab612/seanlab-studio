const activeStatuses = new Set(["queued", "running"]);

export const activeProjectJob = (records, projectId) =>
  [...records].find((record) => record.projectId === projectId && activeStatuses.has(record.status));

export const assertProjectHasNoActiveJob = (records, projectId) => {
  const active = activeProjectJob(records, projectId);
  if (active) throw new Error("当前项目已有任务正在运行");
};

export const ownedProjectJob = (records, projectId, jobId) => {
  const record = records.get(jobId);
  return record?.projectId === projectId ? record : undefined;
};
