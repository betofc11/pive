// Runs once in the main Jest process, before the test workers start (they inherit it).
// A fixed time zone with daylight saving time makes the date tests meaningful on any machine:
// in UTC, "local date" and "UTC date" would be the same and those bugs would go unnoticed.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
