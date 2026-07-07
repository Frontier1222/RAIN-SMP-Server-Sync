export class NotFoundException extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'NotFoundException';
    }
}
