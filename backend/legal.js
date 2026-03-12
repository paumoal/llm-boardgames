//==============================================================================
// legal.js
//==============================================================================

const {
    acons,
    adjoin,
    adjoinit,
    amongp,
    arg1,
    arg2,
    assoc,
    backup,
    baseapply,
    baseapplybuiltin,
    baseapplylist,
    baseapplymath,
    baseapplyrs,
    baseanswers,
    basefindg,
    basefindn,
    basefindp,
    basefinds,
    basefindx,
    basesome,
    basesomeand,
    basesomeatom,
    basesomebase,
    basesomedistinct,
    basesomeground,
    basesomenot,
    basesomeor,
    basesomesame,
    basesomeview,
    baseunindex,
    bitand,
    bitior,
    bitlsh,
    bitnot,
    bitxor,
    callconjunction,
    calldistinct,
    calleval,
    callevaluation,
    callmember,
    callnegation,
    callsame,
    car,
    cdr,
    cons,
    delistify,
    dropfact,
    eliminatefacts,
    eliminaterules,
    envlookupfacts,
    eval,
    factindexps,
    find,
    findp,
    first,
    flatindex,
    flatunindex,
    freevarsexp,
    fullindex,
    fullunindex,
    getbases,
    getdate,
    getfactarity,
    getrulearity,
    getviews,
    getyear,
    head,
    index,
    indexps,
    indexsymbol,
    insertfact,
    insertrule,
    kif,
    len,
    list,
    makedefinition,
    makeequality,
    makeinequality,
    makenegation,
    maketransition,
    numberize,
    plugvar,
    plugexp,
    remfact,
    remcontent,
    reverse,
    rplaca,
    rplacd,
    scan,
    seq,
    stripquotes,
    stringify,
    symbolize,
    tail,
    unify,
    unindexsymbol,
    variance,
    symbolp,
    append,
    binaryappend,
    debugfindn,
    debugfindp,
    debugfinds,
    debugfindx,
    fastread,
    fastreaddata,
    fastreaditems,
    getdataset,
    getlength,
    getmonth,
    getsecond,
    grindspaces,
    hastype,
    kifexp,
    kifparenlist,
    listify,
    makeexistential,
    midrange,
    minimum,
    newsymbolize,
    read,
    readitems,
    scanstring,
    tracecall,
    traceexit,
    untrace,
    uniquify,
    zniquify,
    definemorerules,
    //compfinds,
    nil,
    nullp,
    lookuprules,
    indexees,
    compfindp,
    compfindx,
    compfinds,
    compfindn,
    compfindg,
    sortfinds,
    compvalue

} = require('./epilog');

const {
    //findroles,
    findbases,
    findactions,
    //findinits,
    //findcontrol,
    findlegalp,
    //findlegalx,
    findlegals,
    findreward,
    findterminalp,
    //simulate,
    makestate,
    symbolfindp,
    symbolcompute,
    symbolfindatom,
    symbolfindand,
    symbolfindbackground,
    symbolfindrs,
    symbolfindsubs,
    symbolitem,
    symbolitems,
    symbolvalue,
    symbolvalues,
    symbolexpand,
    symbolexpanddepth,
    symbolexpanddepthand,
    symbolexpanddepthtransition,
    symbolexpanddepthrs,
    idcharp
} = require('./symbol');

const {
    findinits,
    findroles,
    findcontrol,
    findlegalx,
    simulate
} = require('./player')

var role = 'robot';
var rules = [];
var startclock = 10;
var playclock = 10;

var library = [];
var roles = [];
var state = [];

//==============================================================================

function ping() { return 'ready' }

function start(r, rs, sc, pc) {
    role = r;
    rules = rs.slice(1);
    startclock = numberize(sc);
    playclock = numberize(pc);
    library = definemorerules([], rs.slice(1));
    roles = findroles(library);
    state = findinits(library);
    return 'ready'
}

function play(move) {
    console.log(role)
    if (move !== nil) { state = simulate(move, state, library) };
    //console.log({ newstate: state })
    return state
        //if (findcontrol(state, library) !== role) { return false };
        //return findlegalx(state, library)
}

function stop(move) { return false }

function abort() { return false }

module.exports = {
    ping,
    start,
    play,
    stop,
    abort

};

//==============================================================================
// End of player code
//==============================================================================