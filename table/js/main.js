'use strict';

function mergeAll(objs) {
  return _.merge.apply(_, objs);
}

function collectKeys(objs) {
  return _.uniq(_.flatMap(objs, (o) => Object.keys(o)));
}

class Main {
  constructor(nodes) {
    this.nodes = _.cloneDeep(nodes);
    this.domNodes = document.querySelector(".nodes");
    this.domApiKey = document.querySelector(".api-key");

    let nodesTemplate = document.querySelector("#nodes-template").innerText;
    this.renderNodes = Handlebars.compile(nodesTemplate);
    this.refreshTable(this.process(_.cloneDeep(nodes)));

    this.intervalId = null;
    this.domToggle = document.querySelector(".toggle");
  }

  toggle() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
      this.domToggle.classList.remove("working");
    } else {
      let interval = +Main.domInterval().value;
      if (interval <= 0) this.runRequest();
      else {
        this.runIntervalRequests(interval * 1000);
        this.domToggle.classList.add("working");
      }
    }
  }

  static domInterval() {
    return document.querySelector(".interval:checked");
  }

  runIntervalRequests(interval) {
    this.runRequest().then(() => {
      this.intervalId = setTimeout(this.runIntervalRequests.bind(this, interval), interval);
    });
  }

  runRequest() {
    return Promise
        .all([
            new Promise((resolve) => resolve(_.cloneDeep(this.nodes))),
            this.loadVersions(),
            this.loadUtx(),
            this.loadDebugInfo(),
            this.loadMinerInfo(),
            this.loadHistoryInfo()
        ])
        .then(mergeAll)
        .then((nodes) => {
            this.refreshTable(this.process(nodes))
        });
  }

  loadVersions() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/node/version")
        .then((response) => {
          return {
            version: response.version
          };
        })
        .catch((e) => {
          return {
            version: e.message
          };
        })
    });
  }


  loadUtx() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/transactions/unconfirmed/size")
        .then((response) => {
          return {
            UTX: response.size
          };
        })
        .catch((e) => {
          return {
            version: e.message
          };
        })
    });
  }


  loadDebugInfo() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/debug/info")
        .then((response) => {
          return {
            STATE: response.stateHeight + "," + response.stateHash,
            persisted: response.blockchainDebugInfo.persisted.height + "," + response.blockchainDebugInfo.persisted.hash,
            bottom: response.blockchainDebugInfo.bottom.height + "," + response.blockchainDebugInfo.bottom.hash,
            top: response.blockchainDebugInfo.top.height + "," + response.blockchainDebugInfo.top.hash,
            microHash: response.blockchainDebugInfo.microBaseHash
            //   lastBlockId : response.blockchainDebugInfo.lastBlockId
          };
        })
        .catch((e) => {
          return {
            STATE: e.message,
            persisted: e.message,
            bottom: e.message,
            top: e.message,
            microHash: e.message
            //     lastBlockId : e.message
          };
        })
    });
  }

  loadHistoryInfo() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/debug/historyInfo")
        .then((response) => {
          return {
            lastMicros: response.microBlockIds.join("<br />"),
            lastBlocks: response.lastBlockIds.join("<br />")
          };
        })
        .catch((e) => {
          return {
            lastMicros: e.message,
            lastBlocks: e.message,
          };
        })
    });
  }


  loadMinerInfo() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/debug/minerInfo")
        .then((response) => {
          return {
            address: response[0].address,
            miningBalance: "~" + Math.ceil(response[0].miningBalance / 10000000) + " waves",
            //  timestamp: response[0].timestamp,
            in: Math.round((response[0].timestamp - new Date()) / 1000) + " seconds"
          };
        })
        .catch((e) => {
          return {
            address: "???",
            miningBalance: "???",
            // timestamp = "???"
            in: "???"
          };
        })
    });
  }


  loadSeed() {
    return this.load((node) => {
      return this.apiRequest("GET", node, "/wallet/seed")
        .then((response) => {
          return {
            seed: response.seed
          };
        })
        .catch((e) => {
          return {
            seed: e.message
          };
        })
    });
  }

  load(f) {
    return Promise
      .all(
        Object.keys(this.nodes).map((node => {
          return f(node).then((r) => {
            let final = {};
            final[node] = r;
            return final;
          });
        }))
      )
      .then((all) => mergeAll(all));
  }

  refreshTable(data) {
    this.domNodes.innerHTML = this.renderNodes(data);
    new Tablesort(this.domNodes);
  }

  process(nodes) {
    let objs = nodes;

    let values = Object.values(objs);
    let attrs = collectKeys(nodes);
    let uniq = mergeAll(attrs.map((attr) => {
      let o = {};
      o[attr] = _.uniq(values.map((v) => v[attr] || "?"));
      return o;
    }));

    for (let k in objs) {
      for (let attr of attrs) {
        let v = objs[k][attr];
        objs[k][attr] = {
          class: "class_common class_" + uniq[attr].indexOf(v),
          value: v
        };
      }
    }

    return {
      attrs: _.without(attrs, 'nodeId'),
      nodes: objs
    };
  }

  apiRequest(method, rest, action) {
    let apiKey = this.domApiKey.value;
    return Utils.jsonHttpRequest(method, "http://" + rest + action, {
      api_key: apiKey
    });
  }

  static loadNodes() {
    return Utils.jsonHttpRequest("GET", "../data/nodes.json");
  }
}

Main.loadNodes().then(
  (nodes) => {
    console.log("Loaded nodes", nodes);
    window.MainApp = new Main(nodes)
  },
  (x) => console.error(x)
);
