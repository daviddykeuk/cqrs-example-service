# CQRS Example
This project is an example of how to apply a CQRS pattern for a microservice project. It utilises event sourcing as a single source of immutable truth for its ecosystem, processing commands and transactions to the hub, subscribing to the event stream, aggregating them and then allow them to be queried.

At first glance this project may look like overkill for a pretty simple CRUD service, but out of the box you get a lot of extensible functionality.
* A single source of truth
* Prevention of race conditions
* Audit logging
* The ability to add new views to manipulate the data in any peceived way without effecting the underlying system, using any type of technology

## Running
The system uses mongodb and a docker image for the event-hub `daviddyke/cqrs-event-hub`, as well as a generic api gateway for accessing `turbosonic/api-gateway` the rest of the code can be run from the docker-compose file.
```bash
$ docker-compose up
```

NONE OF THIS PROJECT IS PRODUCTION READY CODE (yet)