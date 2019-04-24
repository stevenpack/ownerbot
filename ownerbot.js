
if (typeof addEventListener !== 'undefined') {
    addEventListener('fetch', event => { event.respondWith(process(event.request)) });
}

//process the user request and getResponse
function process(request)
{
    try {
      console.info("processing request");
        return respondTo(request);
    }
    catch (e) {
        console.error(e);
        return respondWith(500);
    }
}

async function respondTo(request) {
    try {
        if (request.method !== 'POST') {
            return respondWith(405);
        }
        let payload = await request.json();
        if (!payload.token) {
            return respondWith(400, "token required");
        }
        console.info("Loading token...");
        const token = await OWNERBOT_KV_STORE.get("token");
        if (payload.token !== token) {
            return respondWith(401, `Invalid token`);
        }
        let ownerBot = new OwnerBotImpl(OWNERBOT_KV_STORE);
        let res = await ownerBot.getResponse(payload);
        return respondWith(200, res);
    } catch (e) {
        console.error(e.stack);
        return respondWith(500, e.message);
    }
}

function respondWith(statusCode, text = null) {

    let body = undefined;
    if (text) {
        body = {
            text: text
        };
    }
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "max-age=1" //don't cache answers like query and export!
        }
    });
}

class OwnerBotImpl {
    constructor(kv) {
        this.kv = kv;
    }

    async getResponse(payload) {
        switch (payload.type) {
            case "ADDED_TO_SPACE":
                return this.onAddedToSpace();
            case "REMOVED_FROM_SPACE":
                return this.onRemovedFromSpace();
            case "MESSAGE":
                return await this.onMessage(payload);
            default:
                return "Unknown message type";
        }
    }

    onAddedToSpace() {
        return "Greetings seeker. I dispense, knowledge and wisdom of services from my codex. Thou mayest " +
            "query my vast knowledge thus: " + this.getUsage();
    }

    onRemovedFromSpace() {
        return "Fare thee well. Remember the virtues."
    }

    getUsage() {
        return "@ownerbot Kibana";
    }

    async onMessage(payload) {
        try {
            let msg = payload.message;
            let arg = msg.argumentText || "";
            arg = arg.trim();
    
            const serviceDirectory = new ServiceDirectory(this.kv);
            await serviceDirectory.init();
    
            let factory = new CommandFactory(serviceDirectory, this.kv);
            let cmd = factory.create(arg);
            if (cmd) {
                let res = await cmd.respond();
                console.debug(`Got response ${JSON.stringify(res)}`);
                return res.text;
            }
            return `I understandeth not. You may query my vast knowledge thus: ${this.getUsage()}`;
        } catch (e) {
            console.error(e.stack);
            return `Alas, thou hast failed. Considereth thou the following: ${e.message}`
        }
    }
}

class CommandFactory {
    constructor(serviceDirectory, kv) {
        this.serviceDirectory = serviceDirectory;
        this.kv = kv;
    }

    create(argumentText) {
        let parts = argumentText.split(' ');
        let primary = parts[0];       
        //@ownerbot Kibana
        //@ownerbot add NinjaPanel "Internal Tools" "Internal Tools" "https://..." "alias1,alias2" pwd
        //@ownerbot delete NinjaPanel pwd
        //@ownerbot help
        //@ownerbot export
        switch (primary) {
            case "add":
                return new AddCommand(argumentText, this.serviceDirectory, this.kv);
            case "delete":
                return new DeleteCommand(argumentText, this.serviceDirectory, this.kv);
            case "help":
                return new HelpCommand(argumentText, this.serviceDirectory, this.kv);
            case "export":
                return new ExportCommand(argumentText, this.serviceDirectory, this.kv);
            default:
                return new QueryCommand(argumentText, this.serviceDirectory, this.kv);
        }
    }
}

class Command {
    constructor(argumentText, serviceDirectory, kv) {
        this.argumentText = argumentText;
        this.serviceDirectory = serviceDirectory;    
        this.kv = kv;
        //Magic regex for splitting on spaces, but not in quotes
        //https://stackoverflow.com/questions/37866239/split-a-javascript-by-space-unless-between-quotes-but-without-matching-the-quo
        this.commandParts = this.argumentText.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g);
        //Strip quotes
        this.commandParts = this.commandParts.map(part => part.replace(/"/g,"").replace(/'/g,''));
        console.debug(`${this.argumentText} -> ${this.commandParts}`);
    }

    async respond() {
        console.warn("Expected to override");
        return new OwnerbotResponse("I do not understandeth that command");
    }
}

class OwnerbotResponse {
    constructor(responseText, success) {
        this.text = responseText;        
        //default to true
        this.success = true;
        if (success === false) {
            this.success = false;
        }   
        console.debug(`new OwnerbotResponse {text: '${this.text}', success: ${this.success}}`);
    }
}

class AddCommand extends Command {

    async respond() {
        let cmdParts = this.commandParts;
        console.log(`${cmdParts.length} parts`);
        if (cmdParts.length !== 6) {
            return new OwnerbotResponse("Adding a service requireth Name, Owner, Room Name, Google Chat Room Url and a list of '*space* separted aliases in quotes'. Consider this, and the virtues.", false);
        }
        let name = this.commandParts[1];
        let owner = this.commandParts[2];
        let room = this.commandParts[3];
        let url = this.commandParts[4];
        let aliasesPart = this.commandParts[5];
        let aliases = aliasesPart.split(' ');
        let service = {
            name: name,
            owner: owner,
            room: room,
            url: url,
            aliases: aliases
        }
        await this.serviceDirectory.add(service);
        return new OwnerbotResponse(`My codex has expanded to contain knowledge of ${name}. Congratulations virtuous Paladin.`);
    }
}

class DeleteCommand extends Command {
    async respond() {
        let serviceName = this.commandParts[1];        
        console.log(`Deleting ${serviceName}`)
        let idx = this.serviceDirectory.findIndexByServiceName(serviceName);
        if (idx === -1) {
            let serviceNames = this.serviceDirectory.getNames().join(", ");
            return new OwnerbotResponse(`I knoweth not of ${serviceName} and I do not deleteth by alias. Tryeth thee one of: ${serviceNames}`, false);
        }
        await this.serviceDirectory.delete(serviceName);
        return new OwnerbotResponse(`It is done and shallt be eventually consistent in my Codex`, true);
    }
}

class HelpCommand extends Command {

    async respond() {
        const help = 
            "@ownerbot Kibana\r\n" +
            "@ownerbot add NinjaPanel 'Internal Tools' 'Internal Tools' 'https://chat.google.com/room/abc' 'np alias2'\r\n" +
            "@ownerbot delete NinjaPanel\r\n" +
            "@ownerbot help"
        return new OwnerbotResponse(help);
    }
}

class QueryCommand extends Command {
    async respond() {
        let service = this.serviceDirectory.get(this.argumentText);
        if (service) {
            return new OwnerbotResponse(`${service.owner} owns ${service.name}. Seeketh thee room ${service.room} - ${service.url})`);
        }
        let serviceNames = this.serviceDirectory.getNames().join(", ");
        return new OwnerbotResponse(`I knoweth not of that service. Thou mightst asketh me of: ${serviceNames}`);
    }
}

class ExportCommand extends Command {
    async respond() {
        let serviceJson = this.serviceDirectory.export();
        return new OwnerbotResponse(JSON.stringify(serviceJson, undefined, 2));
    }
}

class ServiceDirectory {     
    constructor(kv) {
        this.kv = kv;
        this.services = [];
        this.version = 0;
    }

    async init() {
        const serviceJson = await this.kv.get("services");
        console.debug(serviceJson);
        const serviceObj = JSON.parse(serviceJson);
        this.services = serviceObj.services;
        this.version = serviceObj.version || 1;
        console.info(`${this.services.length} services (v${this.version})`)
    }

    get(serviceName) {
        if (!this.services || this.services.length === 0) {
            throw new Error('Not intialized. Call await init()');
        }
        console.info(`Get ${serviceName}`)
        return this.find(serviceName);
    }

    async add(service) {
        let existingService = this.find(service.name);
        if (existingService) {
            throw new Error(`${service.name} already exists as a service. Delete it first or use a another name`);            
        }
        for (let alias of service.aliases) {
            existingService = this.find(alias);
            if (existingService) {
                throw new Error(`${service.name} is an alias of ${existingService.name}. You can delete it or use different aliases`);
            }
        }
        this.validate(service);
        
        console.log(`Adding ${service.name}`);
        let count = this.services.push(service);        
        await this.persist();
        console.log(`Have ${count} services`)
        return count;
    }

    validate(service) {
        if (!service.name) {
            throw new Error("Name required.")
        }        
        if (!service.owner) {
            throw new Error("Owner required.")
        }        
        if (!service.room) {
            throw new Error("Room required.")
        }        
        if (!service.url) {
            throw new Error("Url required.")
        }        
        //TODO: validate url
        if (!service.aliases) {
            throw new Eror("Aliases required.")
        }
        if (!Array.isArray(service.aliases)) {
            throw new Error("Aliases must be an array.")
        }
    }

    async delete(serviceName) {
        let idx = this.findIndexByServiceName(serviceName);
        if (idx == -1) {
            return -1;
        }
        this.services.splice(idx, 1);        
        await this.persist();
        return this.services.length;
    }

    export() {
        let serviceObj = {
            services: this.services,
            version: this.version
        };
        return serviceObj;    
    }

    async persist() {
        this.version = this.version + 1;
        let serviceObj = this.export();
        let serviceJson = JSON.stringify(serviceObj);
        console.debug(`Writing to KV...${serviceJson}`);
        await this.kv.put("services", serviceJson);
        console.debug(`Done writing to KV. New version is v${this.version}`);
    }

    getNames() {
        return this.services
            .map(s => s.name)
            .sort((a, b) => a.localeCompare(b));
    }

    /*
    Find by name only (not alias)
    Returns index
    */
    findIndexByServiceName(serviceName) {
        return this.services
            .map(s => s.name.toLowerCase())
            .indexOf(serviceName.toLowerCase())
    }

    /*
    Find by name or alias.
    Returns service
    */
    find(serviceName) {
        for (let service of this.services) {
            if (this.isMatch(service, serviceName)) {
                console.debug(`Match ${serviceName}`)
                return service;
            }
        }
    }

    isMatch(service, name) {
        return service.name.toLowerCase() === name.toLowerCase() ||
            service.aliases.find(a => a.toLowerCase() === name.toLowerCase())
    }
}

if (typeof module !== 'undefined') {
    //Export for testing
    module.exports = { 
        OwnerBotImpl, 
        ServiceDirectory, 
        CommandFactory, 
        HelpCommand, 
        QueryCommand, 
        AddCommand,
        DeleteCommand,
        ExportCommand
    } 
}