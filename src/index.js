/**
 * Configure a ExpressJS middleware to expose useful health/metrics/checks endpoints.
 */

// Default empty configuration
let metrics;
let readinessChecks = [];
let healthChecks = [];

const doCheck = ({ name, check }) =>
  new Promise((resolve) => {
    // Pass in the [ok, warning, critical, unknown] callbacks. i.e. just resolve the promise.
    check(
      () => { resolve({ name, value: 0 }); },
      () => { resolve({ name, value: 1 }); },
      () => { resolve({ name, value: 2 }); },
      () => { resolve({ name, value: 3 }); }
    );
  });

const doReadinessCheck = ({ check }) =>
  // Pass four callbacks so that health checks can be directly re-used for readiness checks
  new Promise((resolve, reject) => check(resolve, reject, reject, reject));

const toPrometheusFormat = (str, { name, value }) => `${str}${name} ${value}\n`;

const addCheck = (check) => healthChecks.push(check);
const addReadinessCheck = (check) => readinessChecks.push(check);
const addMetrics = (m) => { metrics = m; };

const getMiddleware = () => (req, res, next) => {
  res.header('Content-Type', 'text/plain; version=0.0.4');

  if (req.path === '/healthz') {
    if (readinessChecks.length < 1) {
      return Promise.resolve().then(() => res.sendStatus(200));
    }

    const promisedChecks = readinessChecks.map((check) =>
      new Promise((resolve, reject) => doReadinessCheck(check)
        .then(resolve)
        .catch(reject))
    );

    return Promise.all(promisedChecks)
      .then(() => res.sendStatus(200))
      .catch(() => res.sendStatus(500));
  }

  // Run the checks and return in prometheus formats
  else if (req.path === '/checkz') {
    if (healthChecks.length < 1) {
      return Promise.resolve().then(() => res.sendStatus(404));
    }

    const promisedChecks = healthChecks.map((check) =>
      new Promise((resolve, reject) => doCheck(check)
        .then(resolve)
        .catch(reject)
      )
    );

    return Promise.all(promisedChecks)
      .then((check) =>
        res.send(
          check.reduce(toPrometheusFormat, ''))
      );
  }

  // Send any prometheus metrics specified
  else if (req.path === '/metricz') {
    if (!metrics) {
      return Promise.resolve().then(() => res.sendStatus(404));
    }

    return Promise.resolve().then(() => res.send(metrics()));
  }

  return next();
};

const reset = () => {
  metrics = undefined;
  readinessChecks = [];
  healthChecks = [];
};

module.exports = {
  addCheck,
  addReadinessCheck,
  addMetrics,
  getMiddleware,
  reset,
};
