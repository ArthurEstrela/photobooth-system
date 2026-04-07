import { BoothStateRepositoryPort } from '../ports/out/ports';
import { BoothStatus } from '../entities/booth-state.entity';

export class CompleteSessionUseCase {
  constructor(
    private readonly boothStateRepository: BoothStateRepositoryPort,
  ) {}

  async execute(boothId: string): Promise<void> {
    const boothState = await this.boothStateRepository.getState(boothId);

    if (boothState.status !== BoothStatus.IN_SESSION) {
      // Idempotente — já está idle ou em estado inesperado, não faz nada
      return;
    }

    await this.boothStateRepository.updateStatus(boothId, BoothStatus.IDLE);

    console.log(JSON.stringify({
      event: 'SESSION_COMPLETE',
      boothId,
      timestamp: new Date().toISOString(),
    }));
  }
}
