import {
  CustomCommandParamType as CommandType,
  CommandPermissionLevel as Permission,
} from "@minecraft/server";

export class Command {
  constructor() {
    this.name = "";
    this.description = "";
    this.permissionLevel = 0;
    this.mandatoryParameters = [];
    this.optionalParameters = [];
    this.enums = new Map();
  }

  setName(name) { this.name = name; return this; }
  setDescription(desc) { this.description = desc; return this; }

  setPermission(level) {
    const map = { Any: Permission.Any, GameDirectors: Permission.GameDirectors, Admin: Permission.Admin, Host: Permission.Host, Owner: Permission.Owner };
    let p = typeof level === "string" ? map[level] : level;
    // Safe fallback if the permission level doesn't exist
    this.permissionLevel = p !== undefined ? p : 0; 
    return this;
  }
  
  registerEnum(enumName, values) {
    this.enums.set(enumName, values);
    return this;
  }
  
  // Enum params must use CustomCommandParamType.Enum (name matches registerEnum).
  addEnumOption(enumName, required = false) { return this._addOption(enumName, CommandType.Enum, required); }
  addEntitySelectorOption(name, required = false) { return this._addOption(name, CommandType.String, required); }
  addPlayerSelectorOption(name, required = false) { return this._addOption(name, CommandType.String, required); }
  addPositionOption(name, required = false) { return this._addOption(name, CommandType.String, required); }
  addBlockTypeOption(name, required = false) { return this._addOption(name, CommandType.String, required); }
  addItemTypeOption(name, required = false) { return this._addOption(name, CommandType.String, required); }

  addStringOption(name, required = false) { return this._addOption(name, CommandType.String, required); }
  addBooleanOption(name, required = false) { return this._addOption(name, CommandType.Boolean, required); }
  addIntegerOption(name, required = false) { return this._addOption(name, CommandType.Integer, required); }
  addFloatOption(name, required = false) { return this._addOption(name, CommandType.Float, required); }

  _addOption(name, type, required) {
    // Double fallback: if type is STILL undefined, default to String
    const safeType = type !== undefined ? type : CommandType.String;
    const param = { name, type: safeType };
    required ? this.mandatoryParameters.push(param) : this.optionalParameters.push(param);
    return this;
  }

  /** Build a CustomCommand object for registerCommand (cheatsRequired defaults true in API). */
  toDefinition(namespace = "bd") {
    return {
      name: `${namespace}:${this.name}`,
      description: this.description,
      permissionLevel: this.permissionLevel,
      cheatsRequired: false,
      mandatoryParameters: this.mandatoryParameters,
      optionalParameters: this.optionalParameters,
    };
  }
}