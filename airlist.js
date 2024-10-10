var Airtable = require("airtable");
require("dotenv").config();
var base = new Airtable({ apiKey: process.env.AT_API_KEY }).base(
  "appgpfF3tnUkPPT0Q"
);

base("full-to-lite")
  .select({
    // maxRecords: 10,
    view: "Grid view",
  })
  .eachPage(
    function page(records, fetchNextPage) {
      records.forEach(function (record) {
        console.log("Retrieved", record.get("order"));
      });

      fetchNextPage();
    },
    function done(err) {
      if (err) {
        console.error(err);
        return;
      }
    }
  );
