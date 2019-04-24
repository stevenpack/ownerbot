var assert = require('assert');
var {OwnerBotImpl, ServiceDirectory, CommandFactory, 
    HelpCommand, AddCommand, DeleteCommand, QueryCommand, ExportCommand} = require('../ownerbot');

class MockKeyValueStore {
    constructor() {
        this.servicesObj = require('../test/test-services.json');
    }

    get(key) {        
        if (key === "services") {
            return JSON.stringify(this.servicesObj);
        }
        throw new Error("unexpected key " + key);
    }

    put(key, value) {
        if (key !== "services") {
            throw new Error("unexpected key " + key);
        }
    }
}

describe('OwnerbotImpl', function() {
    describe('onMessage', function() {
        let kv = new MockKeyValueStore();
        let ownerbot = new OwnerBotImpl(kv);

        it('can parse and respond to a query message payload', async function() {

            let payload = {
                "token": "xx",
                "type": "MESSAGE",
                "message": {
                "argumentText": "NinjaPanel"
                }
            }
            let resText = await ownerbot.onMessage(payload);
            assert.equal(resText.indexOf("Internal Tools owns NinjaPanel") > -1, true);
        });

        it('can parse and respond to nonsense', async function() {
            let payload = {
                "token": "xx",
                "type": "MESSAGE",
                "message": {
                "argumentText": "blah blah blah"
                }
            }
            let resText = await ownerbot.onMessage(payload);
            console.log(resText)
        });

        it('can parse and response to an add message payload', async function() {
            let payload = {
                "token": "xx",
                "type": "MESSAGE",
                "message": {
                "argumentText": "add SystemX 'Internal Tools' 'Internal Tools' 'https://someroom' 'alias1'"
                }
            }
            let resText = await ownerbot.onMessage(payload);
            console.log("GOT: " + resText)
            assert.equal(resText.indexOf("SystemX") > -1, true, "Expected the system name in the response")
        });
    });
});

describe('ServiceDirectory', async function() {
    let kv = new MockKeyValueStore();
    let dir = new ServiceDirectory(kv);
    await dir.init();

    describe('get', function() {
        it('should return well known entry', async function() {        
            
            let entry = dir.get("NinjaPanel");
            assert.equal(entry.owner, "Internal Tools");
        });
    });

    describe('add', async function() {
        it('should not allow dupe service names', async function() {        
            let service = {
                name: "NinjaPanel",
                owner: "Internal Tools"                
            }
            
            try {
                await dir.add(service)
                assert.fail("Should have thrown on dupe")
            } catch (e) {
                assert.ok(e);
            }            
        });
        
        it('should not allow service names that are aliases of other services', async function() {        
            let service = {
                name: "Bitbucket",
                owner: "Dev Tools"
            }
            try {
                await dir.add(service)
                assert.fail("Should have thrown on dupe alias1")
            } catch (e) {
                assert.ok(e);
            }
        });

        it('should not allow aliases nthat are service names or aliases', async function() {        
            let service = {
                name: "xxx",
                owner: "yyy",
                aliases: ["np"]
            }
            try {
                await dir.add(service)
                assert.fail("Should have thrown on dupe alias2")
            } catch (e) {
                assert.ok(e);
            }
        });

        it('should return newly added services', async function() {
            let service = {
                name: "xxx",
                owner: "yyy",
                room: "room",
                url: "url",
                aliases: []
            }
            await dir.add(service);
            assert(dir.get('xxx'), "Expected newly added service to be there");
        })

        it('should increment version on save', async function() {
            let version = dir.version;
            await dir.persist();
            assert.equal(dir.version, version + 1, "Saving should increment version");
        });
    });
    describe('delete', function() {
        it('should delete', async function() {
            let service = {
                name: "aaa",
                owner: "bbb",
                room: "room",
                url: "url",
                aliases: []
            }
            let count = await dir.add(service);
            let newCount = await dir.delete("aaa");
            assert.notEqual(-1, newCount, "Not found");
            assert.equal(count - newCount, 1, "Expected the count to decrement");
        })
    });
    describe('find by name', function() {
        it('find by name', function() {
            //assert.ok(dir.get("ninjapanel"))
            let idx = dir.findIndexByServiceName("ninjapanel");
            assert.notEqual(idx, -1);
        });
    });
});

describe('CommandFactory', function() {
    let kv = new MockKeyValueStore();

    describe('create', function() {
        let factory = new CommandFactory(kv);        
        
        it('should return help', function() {
            let helpCmd = factory.create("help");
            assert(helpCmd, 'expected a command');
            assert.equal(helpCmd.constructor.name, 'HelpCommand');
        });

        it('should return add', function() {
            let addCmd = factory.create("add");
            assert(addCmd, 'expected a command');
            assert.equal(addCmd.constructor.name, 'AddCommand');
        });
        
        it('should return delete', function() {
            let delCmd = factory.create("delete");
            assert(delCmd, 'expected a command');
            assert.equal(delCmd.constructor.name, 'DeleteCommand');
        });
        

        it('should default to query', function() {
            let queryCmd = factory.create("Kibana");
            assert(queryCmd, 'expected a command');
            assert.equal(queryCmd.constructor.name, 'QueryCommand');

            queryCmd = factory.create("someservice");
            assert(queryCmd, 'expected a command');
            assert.equal(queryCmd.constructor.name, 'QueryCommand');

        });
    })
});

describe('AddCommand', function() {
    let kv = new MockKeyValueStore();
    let dir = new ServiceDirectory(kv);

    describe('add', function() {

        it('parses args all correctly', function() {
            let cmd = new AddCommand("add NinjaPanel 'Internal Tools' 'Internal Tools' 'https://someurl.com' 'alias1 alias2'", dir, kv);
            assert.equal(cmd.commandParts[0], 'add');
            assert.equal(cmd.commandParts[1], 'NinjaPanel');
            assert.equal(cmd.commandParts[2], 'Internal Tools');
            assert.equal(cmd.commandParts[3], 'Internal Tools');
            assert.equal(cmd.commandParts[4], 'https://someurl.com');
            assert.equal(cmd.commandParts[5], 'alias1 alias2');
        });

        it('requires all args', async function() {
            let addCmd = new AddCommand("add NinjaPanel 'Internal Tools' 'Internal Tools'", dir, kv);            
            let res = await addCmd.respond();
            console.log(res.text);
            assert.equal(res.success, false, "Adding with missing args should fail");            
        });

        it('returns success for all args', async function() {
            let addCmd = new AddCommand("add NinjaPanel 'Internal Tools' 'Internal Tools' 'http://some-abc/abc.html' 'np npanel'", dir, kv);            
            let res = await addCmd.respond();
            console.debug(res.text);
            assert.equal(res.success, true, "Should have succeeded with all args");            
        });
    })
})

describe ('QueryCommand', async function() {
    let kv = new MockKeyValueStore();
    let dir = new ServiceDirectory(kv);

    it('Returns added services', async function() {    
        let addCmd = new AddCommand("add AdminPanel 'Internal Tools' 'Internal Tools Room' url 'alias'", dir, kv);            
        await addCmd.respond();

        let queryCmd = new QueryCommand("AdminPanel", dir, kv);
        let res = await queryCmd.respond();
        assert.equal(res.success, true, "Should have succeeded");
        assert(res.text.indexOf('Internal Tools') > -1, "Should have returned the team name in the query response");
    })
})

describe('HelpCommand', function() {
    describe('help', function() {
        it('returns help text', async function() {
            let helpCmd = new HelpCommand("help");
            let res = await helpCmd.respond();
            console.log(res.text)
            assert(res.text);
        })
    })
})

describe('ExportCommand', function() {

    let kv = new MockKeyValueStore();
    let dir = new ServiceDirectory(kv);

    describe('export', function() {
        it('returns the export', async function() {
            await dir.init();
            let exportCmd = new ExportCommand("export", dir, kv);
            let res = await exportCmd.respond();
            console.log(res.text);
            assert(res.success);
            assert(res.text);
        })
    })
})

describe('DeleteCommand', async function() {
    let kv = new MockKeyValueStore();
    let dir = new ServiceDirectory(kv);
    await dir.init();

    describe('delete', async function() {        
        
        it('deletes', async function() {
            console.debug(`Jira exists at ${dir.findIndexByServiceName("Jira")}`);
            assert(dir.findIndexByServiceName("Jira") > -1);
            let delCmd = new DeleteCommand("delete Jira", dir, kv);
            let res = await delCmd.respond();                        
            assert.equal(res.success, true);
            assert.equal(dir.findIndexByServiceName("Jira"), -1);
        });

        it('tells you not found', async function() {
            
            let delCmd = new DeleteCommand("delete xxx", dir, kv);
            let res = await delCmd.respond();
            console.debug(res.text);
            assert.equal(res.success, false);

        })
    });
});