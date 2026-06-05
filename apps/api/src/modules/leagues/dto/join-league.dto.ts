import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class JoinLeagueDto {
  @ApiProperty({ example: 'ABC12345' })
  @IsString()
  @Length(8, 8)
  inviteCode!: string;
}
