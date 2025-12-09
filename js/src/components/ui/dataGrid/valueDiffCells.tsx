/**
 * @file valueDiffCells.tsx
 * @description Cell components for Value Diff summary grid
 *
 * Provides specialized cell renderers for the value diff summary view:
 * - PrimaryKeyIndicatorCell: Shows key icon for primary key columns
 * - ValueDiffColumnNameCell: Column name with context menu for drill-down
 * - MatchedPercentCell: Formatted percentage display
 */

import {
  Box,
  Center,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Spacer,
} from "@chakra-ui/react";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscKey } from "react-icons/vsc";
import { ValueDiffParams } from "@/lib/api/valuediff";
import {
  RecceActionOptions,
  useRecceActionContext,
} from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

// ============================================================================
// PrimaryKeyIndicatorCell
// ============================================================================

export interface PrimaryKeyIndicatorCellProps {
  /** The column name to check */
  columnName: string;
  /** List of primary key column names */
  primaryKeys: string[];
}

/**
 * Cell component that displays a key icon for primary key columns
 *
 * @example
 * <PrimaryKeyIndicatorCell
 *   columnName="user_id"
 *   primaryKeys={["user_id", "order_id"]}
 * />
 */
export function PrimaryKeyIndicatorCell({
  columnName,
  primaryKeys,
}: PrimaryKeyIndicatorCellProps) {
  const isPrimaryKey = primaryKeys.includes(columnName);

  return <Center height="100%">{isPrimaryKey && <Icon as={VscKey} />}</Center>;
}

// ============================================================================
// ValueDiffColumnNameCell
// ============================================================================

export interface ValueDiffColumnNameCellProps {
  /** The column name to display */
  column: string;
  /** Parameters from the value_diff run */
  params: ValueDiffParams;
}

/**
 * Cell component for column names with context menu for drill-down actions
 *
 * @description Renders the column name with a context menu that provides:
 * - "Show mismatched values..." - Opens form to configure detail view
 * - "Show mismatched values for '{column}'" - Directly shows mismatches for this column
 *
 * @example
 * <ValueDiffColumnNameCell
 *   column="email"
 *   params={{ model: "users", primary_key: "id" }}
 * />
 */
export function ValueDiffColumnNameCell({
  params,
  column,
}: ValueDiffColumnNameCellProps) {
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();

  const handleValueDiffDetail = (
    paramsOverride?: Partial<ValueDiffParams>,
    options?: RecceActionOptions,
  ) => {
    const newParams = {
      ...params,
      ...paramsOverride,
    };

    runAction("value_diff_detail", newParams, options);
  };

  return (
    <Flex>
      <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {column}
      </Box>
      <Spacer />

      <Menu.Root lazyMount>
        <Menu.Trigger asChild>
          <IconButton
            className="row-context-menu"
            variant="plain"
            size="sm"
            disabled={featureToggles.disableDatabaseQuery}
          >
            <PiDotsThreeVertical />
          </IconButton>
        </Menu.Trigger>

        <Portal>
          <Menu.Positioner>
            <Menu.Content lineHeight="20px">
              <Menu.ItemGroup title="Action" as={Box} fontSize="8pt">
                <Menu.Item
                  value="show-mismatched-values"
                  fontSize="10pt"
                  onClick={() => {
                    handleValueDiffDetail({}, { showForm: true });
                  }}
                >
                  Show mismatched values...
                </Menu.Item>
                <Menu.Item
                  value="show-mismatched-columns"
                  fontSize="10pt"
                  onClick={() => {
                    handleValueDiffDetail(
                      { columns: [column] },
                      { showForm: false },
                    );
                  }}
                >
                  Show mismatched values for &apos;{column}&apos;
                </Menu.Item>
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Flex>
  );
}

// ============================================================================
// MatchedPercentCell
// ============================================================================

export interface MatchedPercentCellProps {
  /** The percentage value (0-1 scale) */
  value: number | undefined | null;
}

/**
 * Cell component for displaying match percentage with special formatting
 *
 * @description Formats the percentage value with special handling for edge cases:
 * - Values > 99.99% but < 100%: Shows "~99.99 %"
 * - Values > 0% but < 0.01%: Shows "~0.01 %"
 * - null/undefined: Shows "N/A"
 * - Other values: Shows "XX.XX %"
 *
 * @example
 * <MatchedPercentCell value={0.9542} />  // "95.42 %"
 * <MatchedPercentCell value={0.99999} /> // "~99.99 %"
 * <MatchedPercentCell value={null} />    // "N/A"
 */
export function MatchedPercentCell({ value }: MatchedPercentCellProps) {
  let displayValue = "N/A";

  if (value != null) {
    if (value > 0.9999 && value < 1) {
      displayValue = "~99.99 %";
    } else if (value < 0.0001 && value > 0) {
      displayValue = "~0.01 %";
    } else {
      displayValue = `${(value * 100).toFixed(2)} %`;
    }
  }

  return <Box textAlign="end">{displayValue}</Box>;
}
