const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
// The type of the access group.
//
// Can be flexibly defined according to the use case.
//
// Examples:
// - USER_LIST: the users from a list stored in the database;
// - EMAIL_DOMAIN: the users whose email is in a specific domain;
// - GROUP_MEMBER: the users who are members of a specific group;
// - SUBSCRIBER: the users who are subscribers of a specific service / content
//   creator.
export var ObjectAccessGroupType;
(function (ObjectAccessGroupType) {
})(ObjectAccessGroupType || (ObjectAccessGroupType = {}));
export var ObjectPermission;
(function (ObjectPermission) {
    ObjectPermission["READ"] = "read";
    ObjectPermission["WRITE"] = "write";
})(ObjectPermission || (ObjectPermission = {}));
// Check if the requested permission is allowed based on the granted permission.
function isPermissionAllowed(requested, granted) {
    // Users granted with read or write permissions can read the object.
    if (requested === ObjectPermission.READ) {
        return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
    }
    // Only users granted with write permissions can write the object.
    return granted === ObjectPermission.WRITE;
}
// The base class for all access groups.
//
// Different types of access groups can be implemented according to the use case.
class BaseObjectAccessGroup {
    type;
    id;
    constructor(type, id) {
        this.type = type;
        this.id = id;
    }
}
function createObjectAccessGroup(group) {
    switch (group.type) {
        // Implement the case for each type of access group to instantiate.
        //
        // For example:
        // case "USER_LIST":
        //   return new UserListAccessGroup(group.id);
        // case "EMAIL_DOMAIN":
        //   return new EmailDomainAccessGroup(group.id);
        // case "GROUP_MEMBER":
        //   return new GroupMemberAccessGroup(group.id);
        // case "SUBSCRIBER":
        //   return new SubscriberAccessGroup(group.id);
        default:
            throw new Error(`Unknown access group type: ${group.type}`);
    }
}
// Sets the ACL policy to the object metadata.
export async function setObjectAclPolicy(objectFile, aclPolicy) {
    const [exists] = await objectFile.exists();
    if (!exists) {
        throw new Error(`Object not found: ${objectFile.name}`);
    }
    await objectFile.setMetadata({
        metadata: {
            [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
        },
    });
}
// Gets the ACL policy from the object metadata.
export async function getObjectAclPolicy(objectFile) {
    const [metadata] = await objectFile.getMetadata();
    const aclPolicy = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
    if (!aclPolicy) {
        return null;
    }
    return JSON.parse(aclPolicy);
}
// Checks if the user can access the object.
export async function canAccessObject({ userId, objectFile, requestedPermission, }) {
    // When this function is called, the acl policy is required.
    const aclPolicy = await getObjectAclPolicy(objectFile);
    if (!aclPolicy) {
        return false;
    }
    // Public objects are always accessible for read.
    if (aclPolicy.visibility === "public" &&
        requestedPermission === ObjectPermission.READ) {
        return true;
    }
    // Access control requires the user id.
    if (!userId) {
        return false;
    }
    // The owner of the object can always access it.
    if (aclPolicy.owner === userId) {
        return true;
    }
    // Go through the ACL rules to check if the user has the required permission.
    for (const rule of aclPolicy.aclRules || []) {
        const accessGroup = createObjectAccessGroup(rule.group);
        if ((await accessGroup.hasMember(userId)) &&
            isPermissionAllowed(requestedPermission, rule.permission)) {
            return true;
        }
    }
    return false;
}
