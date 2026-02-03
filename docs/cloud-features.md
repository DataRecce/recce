# Cloud Features

Features only available when connected to Recce Cloud.

## Check Events Timeline

GitHub PR-style discussion feature for checks.

### Event Types

| Type | Description |
|------|-------------|
| `check_created` | Initial check creation |
| `comment` | User comments (supports edit/delete) |
| `approval_change` | Check approval status changes |
| `description_change` | Check description updates |
| `name_change` | Check name updates |
| `preset_applied` | Preset configuration applied |

### Key Files

**Backend:**
- `recce/apis/check_events_api.py` - API routes
- `recce/util/cloud/check_events.py` - Cloud client

**Frontend:**
- `js/packages/ui/src/api/checkEvents.ts` - API client
- `js/packages/ui/src/hooks/useCheckEvents.ts` - React hook
- `js/packages/ui/src/components/check/timeline/` - UI components

## State Sync

### Local vs Cloud

| Feature | Local (FileStateLoader) | Cloud (CloudStateLoader) |
|---------|-------------------------|--------------------------|
| Storage | `recce_state.json` | S3 bucket |
| Sync | Manual save | Automatic |
| Collaboration | Single user | Team sharing |
| Events | Not available | Full timeline |

### CloudStateLoader

- Syncs state to Recce Cloud S3
- Automatic conflict resolution
- Real-time updates for team members

## Approval Workflows

### Check Approval States

- **Pending** - Awaiting review
- **Approved** - Passed validation
- **Rejected** - Failed validation
- **Changes Requested** - Needs modifications

### Workflow Integration

- Integrates with CI/CD pipelines
- Blocks merges until approved
- Tracks approval history in timeline

## Authentication

Cloud features require:
1. Recce Cloud account
2. API token configuration
3. Project linked to cloud workspace

```bash
# Set API token
export RECCE_CLOUD_TOKEN=your_token

# Verify connection works by listing organizations
recce cloud list-organizations
```

## API Rate Limits

Cloud APIs have rate limits:
- 100 requests/minute for read operations
- 50 requests/minute for write operations
- Automatic retry with backoff
