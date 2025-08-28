import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ModerationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  HIDE = 'HIDE',
  FLAG = 'FLAG',
}

export class ModerateRatingDto {
  @ApiProperty({ enum: ModerationAction, description: 'Action de modération' })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiProperty({ example: 'Commentaire inapproprié', description: 'Raison de la modération', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
