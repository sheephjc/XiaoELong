function createRenderSession() {
  let sequence = 0;
  let pendingRequestId = 0;

  function begin() {
    pendingRequestId = ++sequence;
    return pendingRequestId;
  }

  return {
    begin,
    ensurePending() {
      return pendingRequestId > 0 ? pendingRequestId : begin();
    },
    current() {
      return pendingRequestId;
    },
    cancel() {
      pendingRequestId = 0;
    },
    accept(requestId) {
      const normalizedRequestId = Number(requestId);
      if (
        !Number.isFinite(normalizedRequestId) ||
        normalizedRequestId <= 0 ||
        normalizedRequestId !== pendingRequestId
      ) {
        return false;
      }

      pendingRequestId = 0;
      return true;
    }
  };
}

module.exports = {
  createRenderSession
};
