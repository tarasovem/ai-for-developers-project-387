import "@typespec/http";
import "@typespec/openapi3";
import "@typespec/rest";

import "./models.tsp";
import "./routes.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;
using TypeSpec.Rest;

@service(#{
  title: "Calendar Booking API v1"
})
@server("https://api.example.com", "Default server")
namespace CalendarBooking.V1;
