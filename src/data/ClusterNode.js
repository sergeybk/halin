import Parser from 'uri-parser';

/**
 * Abstraction that captures details and information about a node in a cluster.
 */
export default class ClusterNode {
    /**
     * Input is a record that comes back from dbms.cluster.overview()
     */
    constructor(record) {
        this.id = record.get('id');
        this.addresses = record.get('addresses');
        this.role = record.get('role');
        this.database = record.get('database');
    }

    getAddress() {
        const boltUri = this.addresses.filter(addr => addr.indexOf('bolt') > -1)[0];

        const parsed = Parser.parse(boltUri);
        return parsed.host;
    }

    protocols() {
        return this.addresses
            .map(addr => Parser.parse(addr))
            .map(parsed => parsed.protocol);
    }
}