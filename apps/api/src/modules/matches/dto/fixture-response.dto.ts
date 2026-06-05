import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FixtureStatus } from '@wcf/shared';

export class FixtureResponseDto {
  @ApiProperty() fixtureId!: number;
  @ApiProperty({ enum: FixtureStatus }) status!: FixtureStatus;
  @ApiPropertyOptional() homeCountryCode!: string | null;
  @ApiPropertyOptional() awayCountryCode!: string | null;
  @ApiProperty() fetchedAt!: string;
}
