function graphql(datas) {
    this.init(datas);
    this.isDefined(datas) && this.isObject(datas) && this.setDatas(datas);
}

graphql.prototype.paths = {
    login: "graphql/system",
    logout: "graphql/system",
    select: "graphql",
    update: "graphql",
    delete: "graphql"
}
graphql.prototype.datas = {}
graphql.prototype.query = {
    action: "",
    table: "",
    fields: [],
    return: [],
    sets: {},
    where: [],
    page: 1,
    pages: 1,
    count: 0,
    limit: 20,
    orderby: []
}
graphql.prototype.constructor = graphql;
graphql.prototype.isObject = function(obj){
    return typeof obj === 'object';
}
graphql.prototype.isDefined = function(svar){
    return typeof svar !== "undefined";
}
graphql.prototype.init = function(datas){
    this.datas = {url: "", token: "", refresh_token: ""};
    this.setDatas(datas);
}
graphql.prototype.setDatas = function(datas){
    this.isObject(datas)
    && Object.assign(this.datas, {url: "", token: "", ...this.datas, ...datas});
}
graphql.prototype.infos = function(){
    console.log({
        paths: this.paths,
        datas: this.datas,
        query: this.query,
    });
}
graphql.prototype.get = function(key){
    return this.isDefined(key)
    && this.isDefined(this.datas[key])
    ? this.datas[key]
    : this.datas;
}
graphql.prototype.login = function(email, password){
    let query = `
        mutation {
            auth_login(email: "${email}", password: "${password}") {
                access_token
                refresh_token
            }
        }
    `;
    return this.send(query, this.paths.login).then(data => {
        let tokens = {
            token: data.data.auth_login.access_token,
            refresh_token: data.data.auth_login.refresh_token
        };
        this.setDatas(tokens);
        return tokens;
    });
}
graphql.prototype.resetQuery = function(){
    this.query.action = "";
    this.query.table = "";
    this.query.fields = [];
    this.query.return = [];
    this.query.sets = {};
    this.query.where = [];
    this.query.page = 1;
    this.query.pages = 1;
    this.query.count = 0;
    this.query.limit = 20;
    this.query.orderby = [];
}
graphql.prototype.select = function(fields){
    this.resetQuery();
    this.query.action = "select";
    this.query.fields = fields.split(" ").map(f=>f.trim());
    return this;
}
graphql.prototype.update = function(fields){
    this.resetQuery();
    this.query.action = "update";
    this.query.fields = fields.split(" ").map(f=>f.trim());
    return this;
}
graphql.prototype.delete = function(fields){
    this.resetQuery();
    this.query.action = "delete";
    this.query.fields = fields.split(" ").map(f=>f.trim());
    return this;
}
graphql.prototype.from = function(table){
    this.query.table = table;
    return this;
}
graphql.prototype.set = function(params){
    this.query.sets = {...params};
    return this;
}
graphql.prototype.limit = function(limit){
    this.query.limit = limit;
    return this;
}
graphql.prototype.page = function(page){
    this.query.page = page;
    return this;
}
graphql.prototype.return = function(fields){
    this.query.return = fields.split(" ").map(f=>f.trim());
    return this;
}
graphql.prototype.where = function(params){
    this.query.where.length == 0 && this.query.where.push([]);
    let index = this.query.where.length - 1;
    this.query.where[index].push(params);
    return this;
}
graphql.prototype.or = function(){
    this.query.where.push([]);
    return this;
}
graphql.prototype.orderby = function(order){
    this.query.orderby = order.split(" ").map(o => o.trim());
    return this;
}
graphql.prototype.send = function(query, path, variables){
    let url = path !== "" && path !== "/"
    ? (this.datas.url+"/"+path)
    : this.datas.url;

    let headers = {"Accept": "application/json", "Content-Type": "application/json"}
    headers = this.datas.token !== ""
    ? {...headers, "Authorization": "Bearer " + this.datas.token}
    : headers;

    variables = this.isDefined(variables) && this.isObject(variables) ? variables : {};

    return fetch(url, {
        method: "POST",
        mode: "cors",
        headers: headers,
        body: JSON.stringify({query, variables})
    }).then(data => data.json());
}
graphql.prototype.cleanProp = function(str){
    return str.replace(/"\s*([^"]+)\s*"\s*:/g, '$1:')
}
graphql.prototype.toGraphql = function(obj){
    return this.cleanProp(JSON.stringify(obj));
}
graphql.prototype.formatFilters = function(){
    let ors = [];
    let ands = [];
    this.query.where.forEach(whs => {
        ands = [];
        whs.forEach(wh => {
            let key = Object.keys(wh)[0];
            let val = wh[key];
            let keys = key.split(".").reverse();
            let w = { [keys[0]] : val};
            keys.forEach((v, i)=>{ i>0 && (w = {[v] : w}) });
            ands.push(w)
        });
        ands.length > 0 && ors.push({ _and : ands });
    });
    let temp = ors.length == 1 ? ors[0] : { _or: ors };
    return Object.keys(temp).length == 0 ? `` : `filter: ${this.toGraphql(temp)}`;
}
graphql.prototype.recursiveFormatFields = function(result){
    let fields = ``;
    Object.keys(result).forEach(k => {
        fields = fields + " " + k;
        if(/\[/.test(k)){
            fields = fields + " { " + k;
            if(!(/_id$/.test(k.replace("]", "")))){
                fields = fields + "_id";
            }
        }
        if(this.isObject(result[k])){
            fields = fields + " { "+this.recursiveFormatFields(result[k])+" }";
        }
        if(/\[/.test(k)){
            fields = fields + " }";
        }
    })
    return fields.replace(/[\[\]]/g, '').trim();
}
graphql.prototype.formatFields = function(tab){
    let result = {};      
    if(!this.isDefined(tab)){ tab = this.query.fields; }
    tab.forEach((str) => {
        const subgroups = str.split('.');
        let currentObject = result;    
        subgroups.forEach((subgroup, index) => {
        if (!currentObject[subgroup]) {
            // Create an empty object if the subgroup doesn't exist
            currentObject[subgroup] = index === subgroups.length - 1 ? '' : {};
        }
        currentObject = currentObject[subgroup];
        });
    });
    return this.recursiveFormatFields(result);
}
graphql.prototype.formatReturn = function(){
    return this.formatFields(this.query.return);
}
graphql.prototype.execute = function(){
    let query = ``;
    let variables = {};
    let table = this.query.table;
    let ids = this.query.fields;
    let fields = this.formatFields();
    let rturn = this.formatReturn();
    let filters = this.formatFilters();
    let filters_pagination = [`limit: ${this.query.limit}`, `page: ${this.query.page}`];
    let sets = this.toGraphql(this.query.sets);
    let orderby = this.query.orderby;

    //Default values
    rturn = rturn == `` ? `id` : rturn;

    //Basics security check
    if(this.query.action == ""){
        return Promise.reject(new Error('No action specified'));
    }
    if(this.query.table == ""){
        return Promise.reject(new Error('No table or collection specified'));
    }
    if(this.query.action == "update" && this.query.sets.length == 0){
        return Promise.reject(new Error('Update action needs fields update / change'));
    }
    if((this.query.action == "update" || this.query.action == "delete") && ids.length == 0){
        return Promise.reject(new Error('Delete or Update action needs ids to delete / update'));
    }

    //SELECT
    if(this.query.action == "select"){        
        
        //Filters
        if(filters !==  ``){
            filters_pagination = [filters, ...filters_pagination]
            filters = `(${filters})`;
        }

        //Sorting
        if(orderby.length > 0){
            filters_pagination = [...filters_pagination, `sort: `+this.toGraphql(orderby)];
        } 

        //Query
        query = `
            query { 
                ${table}(${filters_pagination.join(", ")}){${fields}}
                ${table}_aggregated${filters}{count{id}}
            }
        `;
    }

    //DELETE
    if(this.query.action == "delete"){        
        query = `
            mutation {
                delete_${table}_items(ids: [${ids.join(",")}]){ ids }
            }
        `;
    }

    //UPDATE
    if(this.query.action == "update"){
        query = `
            mutation {
                update_${table}_items(ids: [${ids.join(",")}], data: ${sets}){ ${rturn} }
            }
        `;
    }

    //Send query
    return this.send(query, this.paths[this.query.action], variables);
}

export { graphql as directus }